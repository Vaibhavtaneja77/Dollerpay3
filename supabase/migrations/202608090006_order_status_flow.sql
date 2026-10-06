create or replace function transition_order_status(
  p_order_id uuid,
  p_next_status order_status,
  p_admin_id uuid,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current order_status;
begin
  if not is_admin() then
    raise exception 'admin required';
  end if;

  select status into v_current
  from orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order not found';
  end if;

  if v_current = p_next_status then
    return;
  end if;

  if (
    (v_current = 'PENDING_DEPOSIT' and p_next_status not in ('DEPOSIT_DETECTED', 'DEPOSIT_CONFIRMED', 'PROCESSING_PAYOUT'))
    or (v_current = 'DEPOSIT_DETECTED' and p_next_status not in ('DEPOSIT_CONFIRMED', 'PROCESSING_PAYOUT'))
    or (v_current = 'DEPOSIT_CONFIRMED' and p_next_status not in ('PROCESSING_PAYOUT'))
    or (v_current = 'PROCESSING_PAYOUT' and p_next_status not in ('PAYOUT_SENT', 'COMPLETED'))
    or (v_current = 'PAYOUT_SENT' and p_next_status not in ('COMPLETED'))
    or (v_current in ('COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED'))
  ) then
    raise exception 'invalid state transition';
  end if;

  update orders
  set status = p_next_status,
      admin_id = p_admin_id,
      admin_notes = coalesce(nullif(trim(p_note), ''), admin_notes),
      updated_at = now(),
      lock_version = lock_version + 1
  where id = p_order_id;

  insert into order_status_history(order_id, status, actor_id, note)
  values (p_order_id, p_next_status, p_admin_id, nullif(trim(p_note), ''));

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (p_admin_id, 'ORDER_STATUS_CHANGED', 'order', p_order_id::text, jsonb_build_object('status', p_next_status));
end;
$$;

create or replace function reject_sell_order(p_order_id uuid, p_admin_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_wallet wallets%rowtype;
  v_clean_reason text := nullif(trim(p_reason), '');
begin
  if not is_admin() then raise exception 'admin required'; end if;
  if v_clean_reason is null or char_length(v_clean_reason) < 8 then raise exception 'rejection reason is required'; end if;

  select * into v_order from orders where id = p_order_id for update;
  if v_order.status in ('COMPLETED','REJECTED','CANCELLED') then raise exception 'invalid state transition'; end if;
  select * into v_wallet from wallets where id = v_order.wallet_id for update;
  if v_wallet.locked_balance < v_order.amount_usdt then raise exception 'locked balance mismatch'; end if;

  insert into wallet_ledger(wallet_id, type, amount, reference_type, reference_id, balance_before, balance_after)
  values (v_wallet.id, 'UNLOCK', v_order.amount_usdt, 'order', p_order_id, v_wallet.available_balance, v_wallet.available_balance + v_order.amount_usdt);

  update wallets
  set available_balance = available_balance + v_order.amount_usdt,
      locked_balance = locked_balance - v_order.amount_usdt
  where id = v_order.wallet_id;

  update orders
  set status = 'REJECTED',
      admin_id = p_admin_id,
      rejection_reason = v_clean_reason,
      updated_at = now(),
      lock_version = lock_version + 1
  where id = p_order_id;

  insert into order_status_history(order_id, status, actor_id, note)
  values (p_order_id, 'REJECTED', p_admin_id, v_clean_reason);

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (p_admin_id, 'ORDER_REJECTED', 'order', p_order_id::text, jsonb_build_object('reason', v_clean_reason));
end;
$$;
