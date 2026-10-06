drop index if exists unique_upi_per_user;
drop index if exists unique_bank_per_user;

alter table payment_methods drop constraint if exists valid_upi;
alter table payment_methods drop constraint if exists valid_bank;
alter table payment_methods drop constraint if exists valid_payment_method_details;
alter table payment_methods add constraint valid_payment_method_details check (
  (type = 'upi' and upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z]+$' and length(split_part(upi_id, '@', 1)) between 2 and 256 and length(split_part(upi_id, '@', 2)) between 2 and 64 and qr_path is null and account_holder_name is null and bank_name is null and account_number is null and ifsc is null)
  or (type = 'bank' and account_holder_name is not null and length(trim(account_holder_name)) >= 2 and bank_name is not null and length(trim(bank_name)) >= 2 and account_number ~ '^[0-9]{9,18}$' and ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$' and upi_id is null and qr_path is null)
  or (type = 'qr' and qr_path is not null and length(trim(qr_path)) >= 3 and upi_id is null and account_holder_name is null and bank_name is null and account_number is null and ifsc is null)
);

create unique index unique_upi_per_user on payment_methods(user_id, lower(upi_id)) where type = 'upi';
create unique index unique_bank_per_user on payment_methods(user_id, account_number, ifsc) where type = 'bank';
create unique index if not exists unique_qr_per_user on payment_methods(user_id, qr_path) where type = 'qr';

alter table orders add constraint orders_min_transaction_amount check (amount_usdt >= 50) not valid;
alter table deposit_requests add constraint deposit_requests_min_transaction_amount check (amount_usdt >= 50) not valid;

alter table orders validate constraint orders_min_transaction_amount;
alter table deposit_requests validate constraint deposit_requests_min_transaction_amount;

update platform_settings
set min_sell_amount = greatest(min_sell_amount, 50),
    updated_at = now()
where id = 1;

create or replace function create_sell_order(p_ticket_id text, p_amount_usdt numeric, p_payment_method_id uuid, p_idempotency_key uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_profile profiles%rowtype;
  v_wallet wallets%rowtype;
  v_method payment_methods%rowtype;
  v_settings platform_settings%rowtype;
  v_order_id uuid;
  v_gross numeric(28,2);
  v_fees numeric(28,2);
  v_net numeric(28,2);
  v_queue integer;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into v_profile from profiles where id = v_user for update;
  if v_profile.status <> 'active' then raise exception 'user is not active'; end if;
  select * into v_settings from platform_settings where id = 1;
  if v_settings.maintenance_mode then raise exception 'maintenance mode'; end if;
  if p_amount_usdt < 50 then raise exception 'minimum withdrawal amount is 50 usdt'; end if;
  if p_amount_usdt < v_settings.min_sell_amount or p_amount_usdt > v_settings.max_sell_amount then raise exception 'amount outside limits'; end if;
  select * into v_wallet from wallets where user_id = v_user for update;
  if not found or v_wallet.available_balance < p_amount_usdt then raise exception 'insufficient balance'; end if;
  select * into v_method from payment_methods where id = p_payment_method_id and user_id = v_user and status = 'active';
  if not found then raise exception 'invalid payment method'; end if;

  select id into v_order_id from orders where user_id = v_user and idempotency_key = p_idempotency_key;
  if v_order_id is not null then return v_order_id; end if;

  v_gross := round(p_amount_usdt * v_settings.usdt_inr_rate, 2);
  v_fees := round(v_gross * v_settings.platform_fee_percent / 100, 2);
  v_net := v_gross - v_fees;
  select coalesce(max(queue_position), 0) + 1 into v_queue from orders where status in ('PENDING_DEPOSIT','DEPOSIT_DETECTED','DEPOSIT_CONFIRMED','PROCESSING_PAYOUT');

  insert into orders(ticket_id, idempotency_key, user_id, wallet_id, amount_usdt, rate, gross_inr, fees, net_inr, payment_method_id, payment_method_snapshot, status, queue_position)
  values (
    p_ticket_id,
    p_idempotency_key,
    v_user,
    v_wallet.id,
    p_amount_usdt,
    v_settings.usdt_inr_rate,
    v_gross,
    v_fees,
    v_net,
    p_payment_method_id,
    to_jsonb(v_method) - 'account_number' || jsonb_build_object('account_number_masked', case when v_method.account_number is null then null else right(v_method.account_number, 4) end),
    'PENDING_DEPOSIT',
    v_queue
  )
  returning id into v_order_id;

  update wallets set available_balance = available_balance - p_amount_usdt, locked_balance = locked_balance + p_amount_usdt where id = v_wallet.id;
  insert into wallet_ledger(wallet_id, type, amount, reference_type, reference_id, balance_before, balance_after)
  values (v_wallet.id, 'LOCK', p_amount_usdt, 'order', v_order_id, v_wallet.available_balance, v_wallet.available_balance - p_amount_usdt);
  insert into order_status_history(order_id, status, actor_id, note) values (v_order_id, 'PENDING_DEPOSIT', v_user, 'Order created');
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata) values (v_user, 'ORDER_CREATED', 'order', v_order_id::text, jsonb_build_object('ticket_id', p_ticket_id));
  return v_order_id;
end;
$$;

create or replace function expire_pending_sell_orders(p_user_id uuid default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_wallet wallets%rowtype;
  v_count integer := 0;
begin
  for v_order in
    select *
    from orders
    where status = 'PENDING_DEPOSIT'
      and created_at <= now() - interval '6 hours'
      and (p_user_id is null or user_id = p_user_id)
    order by created_at
    for update skip locked
  loop
    select * into v_wallet from wallets where id = v_order.wallet_id for update;

    if v_wallet.locked_balance < v_order.amount_usdt then
      raise exception 'locked balance mismatch';
    end if;

    insert into wallet_ledger(wallet_id, type, amount, reference_type, reference_id, balance_before, balance_after)
    values (v_wallet.id, 'UNLOCK', v_order.amount_usdt, 'order', v_order.id, v_wallet.available_balance, v_wallet.available_balance + v_order.amount_usdt);

    update wallets
    set available_balance = available_balance + v_order.amount_usdt,
        locked_balance = locked_balance - v_order.amount_usdt
    where id = v_wallet.id;

    update orders
    set status = 'EXPIRED',
        admin_notes = coalesce(admin_notes, 'Order expired after 6 hours pending window.'),
        updated_at = now(),
        lock_version = lock_version + 1
    where id = v_order.id;

    insert into order_status_history(order_id, status, actor_id, note)
    values (v_order.id, 'EXPIRED', null, 'Order expired after 6 hours pending window.');

    insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (null, 'ORDER_EXPIRED', 'order', v_order.id::text, jsonb_build_object('expired_after_hours', 6));

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function expire_pending_deposit_requests(p_user_id uuid default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_deposit deposit_requests%rowtype;
  v_count integer := 0;
begin
  for v_deposit in
    select *
    from deposit_requests
    where status = 'PENDING_DEPOSIT'
      and created_at <= now() - interval '1 hour'
      and (p_user_id is null or user_id = p_user_id)
    order by created_at
    for update skip locked
  loop
    update deposit_requests
    set status = 'EXPIRED',
        rejection_reason = coalesce(rejection_reason, 'Deposit request expired after 1 hour pending window.')
    where id = v_deposit.id;

    insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (null, 'DEPOSIT_EXPIRED', 'deposit_request', v_deposit.id::text, jsonb_build_object('expired_after_hours', 1));

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function expire_pending_sell_orders(uuid) to authenticated;
grant execute on function expire_pending_deposit_requests(uuid) to authenticated;
