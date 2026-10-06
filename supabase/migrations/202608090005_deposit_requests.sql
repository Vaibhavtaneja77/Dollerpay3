create type deposit_request_status as enum ('PENDING_DEPOSIT','DEPOSIT_CONFIRMED','REJECTED');

create table deposit_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null unique,
  user_id uuid not null references profiles(id) on delete restrict,
  wallet_id uuid not null references wallets(id) on delete restrict,
  amount_usdt numeric(28, 8) not null check (amount_usdt > 0),
  network text not null,
  admin_wallet_address text not null,
  proof_path text not null,
  status deposit_request_status not null default 'PENDING_DEPOSIT',
  admin_id uuid references profiles(id),
  admin_notes text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index deposit_requests_user_id_idx on deposit_requests(user_id);
create index deposit_requests_status_idx on deposit_requests(status);
create index deposit_requests_created_at_idx on deposit_requests(created_at desc);
create index deposit_requests_ticket_id_idx on deposit_requests(ticket_id);

alter table deposit_requests enable row level security;

create policy deposit_requests_own_or_admin on deposit_requests
for select using (user_id = auth.uid() or is_admin());

create or replace function verify_deposit_request(p_deposit_id uuid, p_admin_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_deposit deposit_requests%rowtype;
  v_wallet wallets%rowtype;
begin
  if not is_admin() then raise exception 'admin required'; end if;

  select * into v_deposit
  from deposit_requests
  where id = p_deposit_id
  for update;

  if not found then raise exception 'deposit request not found'; end if;
  if v_deposit.status <> 'PENDING_DEPOSIT' then raise exception 'invalid deposit state'; end if;

  select * into v_wallet
  from wallets
  where id = v_deposit.wallet_id
  for update;

  update wallets
  set available_balance = available_balance + v_deposit.amount_usdt
  where id = v_wallet.id;

  insert into wallet_ledger(wallet_id, type, amount, reference_type, reference_id, balance_before, balance_after)
  values (
    v_wallet.id,
    'DEPOSIT',
    v_deposit.amount_usdt,
    'deposit_request',
    v_deposit.id,
    v_wallet.available_balance,
    v_wallet.available_balance + v_deposit.amount_usdt
  );

  update deposit_requests
  set status = 'DEPOSIT_CONFIRMED',
      admin_id = p_admin_id,
      admin_notes = p_note,
      verified_at = now()
  where id = p_deposit_id;

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (p_admin_id, 'DEPOSIT_CONFIRMED', 'deposit_request', p_deposit_id::text, jsonb_build_object('amount_usdt', v_deposit.amount_usdt));
end;
$$;

create or replace function reject_deposit_request(p_deposit_id uuid, p_admin_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status deposit_request_status;
begin
  if not is_admin() then raise exception 'admin required'; end if;

  select status into v_status
  from deposit_requests
  where id = p_deposit_id
  for update;

  if not found then raise exception 'deposit request not found'; end if;
  if v_status <> 'PENDING_DEPOSIT' then raise exception 'invalid deposit state'; end if;

  update deposit_requests
  set status = 'REJECTED',
      admin_id = p_admin_id,
      rejection_reason = p_reason
  where id = p_deposit_id;

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (p_admin_id, 'DEPOSIT_REJECTED', 'deposit_request', p_deposit_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

revoke execute on function verify_deposit_request(uuid, uuid, text) from public;
revoke execute on function reject_deposit_request(uuid, uuid, text) from public;
grant execute on function verify_deposit_request(uuid, uuid, text) to authenticated;
grant execute on function reject_deposit_request(uuid, uuid, text) to authenticated;
