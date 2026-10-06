alter table profiles force row level security;
alter table wallets force row level security;
alter table wallet_ledger force row level security;
alter table payment_methods force row level security;
alter table orders force row level security;
alter table order_status_history force row level security;
alter table transactions force row level security;
alter table payment_proofs force row level security;
alter table admin_notes force row level security;
alter table audit_logs force row level security;
alter table platform_settings force row level security;
alter table deposit_requests force row level security;
alter table referrals force row level security;
alter table admin_email_allowlist force row level security;

alter table orders drop constraint if exists orders_min_transaction_amount;
alter table orders alter column payment_method_id drop not null;

update payment_methods
set qr_path = null,
    is_default = false,
    status = 'disabled'
where type = 'qr';

alter table payment_methods drop constraint if exists valid_payment_method_details;
alter table payment_methods add constraint valid_payment_method_details check (
  (type = 'upi' and upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z]+$' and length(split_part(upi_id, '@', 1)) between 2 and 256 and length(split_part(upi_id, '@', 2)) between 2 and 64 and qr_path is null and account_holder_name is null and bank_name is null and account_number is null and ifsc is null)
  or (type = 'bank' and account_holder_name is not null and length(trim(account_holder_name)) >= 2 and bank_name is not null and length(trim(bank_name)) >= 2 and account_number ~ '^[0-9]{9,18}$' and ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$' and upi_id is null and qr_path is null)
) not valid;

drop policy if exists admin_email_allowlist_admin_insert on admin_email_allowlist;
drop policy if exists admin_email_allowlist_admin_delete on admin_email_allowlist;
drop policy if exists admin_email_allowlist_service_insert on admin_email_allowlist;
drop policy if exists admin_email_allowlist_service_delete on admin_email_allowlist;

create policy admin_email_allowlist_service_insert on admin_email_allowlist
for insert with check (auth.role() = 'service_role');

create policy admin_email_allowlist_service_delete on admin_email_allowlist
for delete using (auth.role() = 'service_role');

create table if not exists admin_permissions (
  email text primary key references admin_email_allowlist(email) on delete cascade,
  can_manage_orders boolean not null default true,
  can_manage_deposits boolean not null default true,
  can_manage_referrals boolean not null default true,
  can_manage_users boolean not null default false,
  can_manage_wallets boolean not null default false,
  can_manage_settings boolean not null default false,
  can_manage_admins boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  constraint admin_permissions_email_format check (
    email = lower(email)
    and email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  )
);

alter table admin_permissions enable row level security;
alter table admin_permissions force row level security;

drop policy if exists admin_permissions_admin_select on admin_permissions;
drop policy if exists admin_permissions_admin_write on admin_permissions;
create policy admin_permissions_admin_select on admin_permissions
for select using (is_admin());
create policy admin_permissions_admin_write on admin_permissions
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into admin_permissions (
  email,
  can_manage_orders,
  can_manage_deposits,
  can_manage_referrals,
  can_manage_users,
  can_manage_wallets,
  can_manage_settings,
  can_manage_admins
)
select email, true, true, true, true, true, true, true
from admin_email_allowlist
on conflict (email) do nothing;

create table if not exists rate_limit_buckets (
  key text primary key,
  count integer not null default 0 check (count >= 0),
  reset_at timestamptz not null
);

alter table rate_limit_buckets enable row level security;
alter table rate_limit_buckets force row level security;

drop policy if exists rate_limit_buckets_service_role_only on rate_limit_buckets;
create policy rate_limit_buckets_service_role_only on rate_limit_buckets
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create or replace function check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
)
returns table(limited boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reset_at timestamptz := now() + make_interval(secs => greatest(p_window_ms, 1000) / 1000.0);
  v_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if p_key is null or length(trim(p_key)) = 0 then raise exception 'rate limit key is required'; end if;
  if p_limit <= 0 then raise exception 'rate limit must be positive'; end if;

  insert into rate_limit_buckets(key, count, reset_at)
  values (p_key, 1, v_reset_at)
  on conflict (key) do update
  set count = case
        when rate_limit_buckets.reset_at < v_now then 1
        else rate_limit_buckets.count + 1
      end,
      reset_at = case
        when rate_limit_buckets.reset_at < v_now then v_reset_at
        else rate_limit_buckets.reset_at
      end
  returning count, reset_at into v_count, check_rate_limit.reset_at;

  limited := v_count > p_limit;
  remaining := greatest(0, p_limit - v_count);
  return next;
end;
$$;

revoke execute on function check_rate_limit(text, integer, integer) from public;
revoke execute on function check_rate_limit(text, integer, integer) from anon;
revoke execute on function check_rate_limit(text, integer, integer) from authenticated;
grant execute on function check_rate_limit(text, integer, integer) to service_role;

drop policy if exists payment_asset_deposit_upload_own on storage.objects;
drop policy if exists payment_asset_deposit_read_own_or_admin on storage.objects;
drop policy if exists payment_asset_qr_upload_own on storage.objects;
drop policy if exists payment_asset_qr_read_own_or_admin on storage.objects;
drop policy if exists payment_asset_qr_update_own on storage.objects;
drop policy if exists payment_asset_qr_delete_own on storage.objects;

create policy payment_asset_deposit_upload_own on storage.objects
for insert with check (
  bucket_id = 'payment-proofs'
  and auth.uid()::text = (storage.foldername(name))[2]
  and (storage.foldername(name))[1] = 'deposits'
);

create policy payment_asset_deposit_read_own_or_admin on storage.objects
for select using (
  bucket_id = 'payment-proofs'
  and (
    is_admin()
    or (
      auth.uid()::text = (storage.foldername(name))[2]
      and (storage.foldername(name))[1] = 'deposits'
    )
  )
);

create policy payment_asset_qr_upload_own on storage.objects
for insert with check (
  bucket_id = 'payment-proofs'
  and auth.uid()::text = (storage.foldername(name))[2]
  and (storage.foldername(name))[1] = 'payment-methods'
);

create policy payment_asset_qr_read_own_or_admin on storage.objects
for select using (
  bucket_id = 'payment-proofs'
  and (
    is_admin()
    or (
      auth.uid()::text = (storage.foldername(name))[2]
      and (storage.foldername(name))[1] = 'payment-methods'
    )
  )
);

create policy payment_asset_qr_update_own on storage.objects
for update using (
  bucket_id = 'payment-proofs'
  and auth.uid()::text = (storage.foldername(name))[2]
  and (storage.foldername(name))[1] = 'payment-methods'
) with check (
  bucket_id = 'payment-proofs'
  and auth.uid()::text = (storage.foldername(name))[2]
  and (storage.foldername(name))[1] = 'payment-methods'
);

create policy payment_asset_qr_delete_own on storage.objects
for delete using (
  bucket_id = 'payment-proofs'
  and auth.uid()::text = (storage.foldername(name))[2]
  and (storage.foldername(name))[1] = 'payment-methods'
);

create or replace function register_referral(p_referral_code text, p_referred_user_id uuid default auth.uid())
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_referral_id uuid;
  v_referred_user_id uuid := auth.uid();
begin
  if v_referred_user_id is null then raise exception 'not authenticated'; end if;
  if p_referred_user_id is not null and p_referred_user_id <> v_referred_user_id then raise exception 'cannot register referral for another user'; end if;
  if p_referral_code is null or length(trim(p_referral_code)) = 0 then raise exception 'referral code is required'; end if;

  select id into v_referrer_id
  from profiles
  where referral_code = upper(trim(p_referral_code))
    and role = 'customer'
    and status = 'active';

  if not found then raise exception 'invalid referral code'; end if;
  if v_referrer_id = v_referred_user_id then raise exception 'self referral is not allowed'; end if;

  select id into v_referral_id
  from referrals
  where referred_user_id = v_referred_user_id;

  if v_referral_id is not null then
    return v_referral_id;
  end if;

  insert into referrals(referrer_id, referred_user_id)
  values (v_referrer_id, v_referred_user_id)
  returning id into v_referral_id;

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (v_referred_user_id, 'REFERRAL_REGISTERED', 'referral', v_referral_id::text, jsonb_build_object('referrer_id', v_referrer_id));

  perform refresh_referrals_for_referrer(v_referrer_id);

  return v_referral_id;
end;
$$;

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

  perform refresh_referrals_for_referred_user(v_deposit.user_id);

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (p_admin_id, 'DEPOSIT_CONFIRMED', 'deposit_request', p_deposit_id::text, jsonb_build_object('amount_usdt', v_deposit.amount_usdt));
end;
$$;

revoke execute on function refresh_referrals_for_referrer(uuid) from authenticated;
revoke execute on function refresh_referrals_for_referred_user(uuid) from authenticated;
revoke execute on function expire_pending_sell_orders(uuid) from authenticated;
revoke execute on function expire_pending_deposit_requests(uuid) from authenticated;
revoke execute on function refresh_referrals_for_referrer(uuid) from anon;
revoke execute on function refresh_referrals_for_referred_user(uuid) from anon;
revoke execute on function expire_pending_sell_orders(uuid) from anon;
revoke execute on function expire_pending_deposit_requests(uuid) from anon;

grant execute on function refresh_referrals_for_referrer(uuid) to service_role;
grant execute on function refresh_referrals_for_referred_user(uuid) to service_role;
grant execute on function expire_pending_sell_orders(uuid) to service_role;
grant execute on function expire_pending_deposit_requests(uuid) to service_role;

create or replace function adjust_wallet_available_balance(
  p_wallet_id uuid,
  p_admin_id uuid,
  p_direction text,
  p_amount_usdt numeric,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet wallets%rowtype;
  v_reason text := nullif(trim(p_reason), '');
  v_next_balance numeric(28, 8);
begin
  if not is_admin() then raise exception 'admin required'; end if;
  if p_direction not in ('credit', 'debit') then raise exception 'invalid adjustment direction'; end if;
  if p_amount_usdt <= 0 then raise exception 'invalid adjustment amount'; end if;
  if v_reason is null or char_length(v_reason) < 8 then raise exception 'adjustment reason is required'; end if;

  select * into v_wallet from wallets where id = p_wallet_id for update;
  if not found then raise exception 'wallet not found'; end if;

  v_next_balance := case
    when p_direction = 'credit' then v_wallet.available_balance + p_amount_usdt
    else v_wallet.available_balance - p_amount_usdt
  end;

  if v_next_balance < 0 then raise exception 'available balance cannot go below zero'; end if;

  insert into wallet_ledger(wallet_id, type, amount, reference_type, reference_id, balance_before, balance_after)
  values (v_wallet.id, 'ADJUSTMENT', p_amount_usdt, 'manual_admin_adjustment', null, v_wallet.available_balance, v_next_balance);

  update wallets
  set available_balance = v_next_balance
  where id = v_wallet.id;

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    p_admin_id,
    case when p_direction = 'credit' then 'WALLET_CREDITED' else 'WALLET_DEBITED' end,
    'wallet',
    p_wallet_id::text,
    jsonb_build_object('amount_usdt', p_amount_usdt, 'reason', v_reason, 'balance_before', v_wallet.available_balance, 'balance_after', v_next_balance)
  );
end;
$$;

revoke execute on function adjust_wallet_available_balance(uuid, uuid, text, numeric, text) from public;
revoke execute on function adjust_wallet_available_balance(uuid, uuid, text, numeric, text) from anon;
grant execute on function adjust_wallet_available_balance(uuid, uuid, text, numeric, text) to authenticated;

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
  v_fees numeric(28,2) := 0;
  v_net numeric(28,2);
  v_queue integer;
  v_payment_snapshot jsonb;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into v_profile from profiles where id = v_user for update;
  if v_profile.status <> 'active' then raise exception 'user is not active'; end if;
  select * into v_settings from platform_settings where id = 1;
  if v_settings.maintenance_mode then raise exception 'maintenance mode'; end if;
  if p_amount_usdt <= 0 or p_amount_usdt > v_settings.max_sell_amount then raise exception 'amount outside limits'; end if;
  select * into v_wallet from wallets where user_id = v_user for update;
  if not found or v_wallet.available_balance < p_amount_usdt then raise exception 'insufficient balance'; end if;
  if p_payment_method_id is null then
    v_payment_snapshot := jsonb_build_object('type', 'qr', 'display_name', 'Digital Erupee');
  else
    select * into v_method from payment_methods where id = p_payment_method_id and user_id = v_user and status = 'active' and type <> 'qr';
    if not found then raise exception 'invalid payment method'; end if;
    v_payment_snapshot := to_jsonb(v_method) - 'account_number' || jsonb_build_object('account_number_masked', case when v_method.account_number is null then null else right(v_method.account_number, 4) end);
  end if;

  select id into v_order_id from orders where user_id = v_user and idempotency_key = p_idempotency_key;
  if v_order_id is not null then return v_order_id; end if;

  v_gross := round(p_amount_usdt * v_settings.usdt_inr_rate, 2);
  v_net := v_gross;
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
    v_payment_snapshot,
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

grant execute on function create_sell_order(text, numeric, uuid, uuid) to authenticated;

update orders
set fees = 0,
    net_inr = gross_inr
where fees <> 0
   or net_inr is distinct from gross_inr;
