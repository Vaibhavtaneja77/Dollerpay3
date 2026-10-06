create extension if not exists pgcrypto;
create extension if not exists supabase_vault with schema vault;

do $$
declare
  v_crypto_key text := '__REPLACE_WITH_APP_CRYPTO_KEY__';
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'app_crypto_key'
      and nullif(decrypted_secret, '') is not null
  ) then
    if v_crypto_key = '__REPLACE_WITH_APP_CRYPTO_KEY__' or nullif(v_crypto_key, '') is null then
      raise exception 'Replace __REPLACE_WITH_APP_CRYPTO_KEY__ with your real encryption key before running this migration.';
    end if;

    perform vault.create_secret(
      v_crypto_key,
      'app_crypto_key',
      'Crypto key for admin and transaction encryption'
    );
  end if;
end;
$$;

create schema if not exists private;

create or replace function private.crypto_key()
returns text
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_key text;
begin
  select decrypted_secret
  into v_key
  from vault.decrypted_secrets
  where name = 'app_crypto_key'
  limit 1;

  if v_key is null then
    raise exception 'Encryption key is not configured';
  end if;

  return v_key;
end;
$$;

create or replace function private.encrypt_text(p_value text)
returns bytea
language sql
stable
security definer
set search_path = public, private
as $$
  select case
    when p_value is null then null
    else extensions.pgp_sym_encrypt(p_value, private.crypto_key(), 'cipher-algo=aes256, compress-algo=1'::text)
  end
$$;

create or replace function private.decrypt_text(p_value bytea)
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select case
    when p_value is null then null
    else extensions.pgp_sym_decrypt(p_value, private.crypto_key())
  end
$$;

revoke all on schema private from public;
revoke all on function private.crypto_key() from public;
revoke all on function private.encrypt_text(text) from public;
revoke all on function private.decrypt_text(bytea) from public;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;
grant execute on function private.decrypt_text(bytea) to authenticated;
grant execute on function private.decrypt_text(bytea) to service_role;

alter table platform_settings
  add column if not exists min_deposit_amount numeric(28, 8) not null default 25 check (min_deposit_amount >= 25),
  add column if not exists admin_wallet_qr_path text,
  add column if not exists admin_wallet_address_encrypted bytea,
  add column if not exists admin_wallet_qr_path_encrypted bytea;

alter table deposit_requests
  alter column proof_path drop not null,
  add column if not exists admin_wallet_address_encrypted bytea;

alter table transactions
  add column if not exists tx_hash_encrypted bytea,
  add column if not exists network_encrypted bytea,
  add column if not exists amount_encrypted bytea;

alter table orders drop constraint if exists orders_min_transaction_amount;
alter table deposit_requests drop constraint if exists deposit_requests_min_transaction_amount;

alter table orders add constraint orders_min_transaction_amount check (amount_usdt >= 25) not valid;
alter table deposit_requests add constraint deposit_requests_min_transaction_amount check (amount_usdt >= 25) not valid;

alter table orders validate constraint orders_min_transaction_amount;
alter table deposit_requests validate constraint deposit_requests_min_transaction_amount;

update platform_settings
set min_sell_amount = greatest(min_sell_amount, 25),
    min_deposit_amount = greatest(min_deposit_amount, 25),
    updated_at = now()
where id = 1;

create or replace function private.encrypt_platform_settings_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.admin_wallet_address is not null and new.admin_wallet_address <> '[encrypted]' then
    new.admin_wallet_address_encrypted := private.encrypt_text(new.admin_wallet_address);
    new.admin_wallet_address := '[encrypted]';
  end if;

  if new.admin_wallet_qr_path is not null then
    new.admin_wallet_qr_path_encrypted := private.encrypt_text(new.admin_wallet_qr_path);
    new.admin_wallet_qr_path := null;
  end if;

  return new;
end;
$$;

create or replace function private.encrypt_deposit_request_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.admin_wallet_address is not null and new.admin_wallet_address <> '[encrypted]' then
    new.admin_wallet_address_encrypted := private.encrypt_text(new.admin_wallet_address);
    new.admin_wallet_address := '[encrypted]';
  end if;

  return new;
end;
$$;

create or replace function private.encrypt_transaction_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.tx_hash is not null then
    new.tx_hash_encrypted := private.encrypt_text(new.tx_hash);
    new.tx_hash := null;
  end if;

  if new.network is not null then
    new.network_encrypted := private.encrypt_text(new.network);
    new.network := null;
  end if;

  if new.amount is not null then
    new.amount_encrypted := private.encrypt_text(new.amount::text);
    new.amount := null;
  end if;

  return new;
end;
$$;

drop trigger if exists encrypt_platform_settings_sensitive_fields_trigger on platform_settings;
create trigger encrypt_platform_settings_sensitive_fields_trigger
before insert or update on platform_settings
for each row execute function private.encrypt_platform_settings_sensitive_fields();

drop trigger if exists encrypt_deposit_request_sensitive_fields_trigger on deposit_requests;
create trigger encrypt_deposit_request_sensitive_fields_trigger
before insert or update on deposit_requests
for each row execute function private.encrypt_deposit_request_sensitive_fields();

drop trigger if exists encrypt_transaction_sensitive_fields_trigger on transactions;
create trigger encrypt_transaction_sensitive_fields_trigger
before insert or update on transactions
for each row execute function private.encrypt_transaction_sensitive_fields();

update platform_settings
set admin_wallet_address = admin_wallet_address,
    admin_wallet_qr_path = admin_wallet_qr_path
where admin_wallet_address <> '[encrypted]'
   or admin_wallet_qr_path is not null;

update deposit_requests
set admin_wallet_address = admin_wallet_address
where admin_wallet_address <> '[encrypted]';

update transactions
set tx_hash = tx_hash,
    network = network,
    amount = amount
where tx_hash is not null
   or network is not null
   or amount is not null;

update audit_logs
set metadata = metadata
  - 'admin_wallet_address'
  - 'admin_wallet_qr_path'
  || jsonb_build_object('admin_sensitive_fields_removed', true)
where entity_type = 'platform_settings'
  and (
    metadata ? 'admin_wallet_address'
    or metadata ? 'admin_wallet_qr_path'
  );

update audit_logs
set entity_id = encode(extensions.digest(entity_id, 'sha256'), 'hex'),
    metadata = metadata || jsonb_build_object('admin_email_hashed', true)
where entity_type = 'admin_email'
  and entity_id !~ '^[a-f0-9]{64}$';

create or replace function create_deposit_request(
  p_ticket_id text,
  p_user_id uuid,
  p_wallet_id uuid,
  p_amount_usdt numeric,
  p_network text,
  p_admin_wallet_address text,
  p_proof_path text default null,
  p_coupon_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon coupons%rowtype;
  v_coupon_code text := nullif(upper(trim(p_coupon_code)), '');
  v_deposit_id uuid;
  v_reserved_count integer;
  v_settings platform_settings%rowtype;
  v_min_deposit numeric(28, 8);
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;

  perform 1
  from wallets
  where id = p_wallet_id
    and user_id = p_user_id
  for update;

  if not found then raise exception 'wallet not found'; end if;

  select * into v_settings from platform_settings where id = 1;
  if not found then raise exception 'platform settings are not configured'; end if;

  v_min_deposit := greatest(coalesce(v_settings.min_deposit_amount, 25), 25);
  if p_amount_usdt < v_min_deposit then
    raise exception 'minimum deposit amount is % usdt', v_min_deposit;
  end if;

  if exists (
    select 1
    from deposit_requests
    where user_id = p_user_id
      and status = 'PENDING_DEPOSIT'
  ) or exists (
    select 1
    from orders
    where user_id = p_user_id
      and status in ('PENDING_DEPOSIT','DEPOSIT_DETECTED','DEPOSIT_CONFIRMED','PROCESSING_PAYOUT','PAYOUT_SENT')
  ) then
    raise exception 'you already have an active order. please wait until it is completed before placing another.';
  end if;

  if v_coupon_code is not null then
    select * into v_coupon
    from coupons
    where code = v_coupon_code
    for update;

    if not found then raise exception 'coupon code is invalid'; end if;
    if not v_coupon.active then raise exception 'coupon code is inactive'; end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then raise exception 'coupon code has expired'; end if;

    select count(*) into v_reserved_count
    from coupon_redemptions
    where coupon_code = v_coupon_code
      and status in ('PENDING','CONFIRMED');

    if v_reserved_count >= v_coupon.max_redemptions then raise exception 'coupon redeem limit reached'; end if;
    if exists (
      select 1
      from coupon_redemptions
      where user_id = p_user_id
        and status = 'PENDING'
    ) then
      raise exception 'you already have a pending coupon redemption';
    end if;
    if exists (
      select 1
      from coupon_redemptions
      where coupon_code = v_coupon_code
        and user_id = p_user_id
        and status in ('PENDING','CONFIRMED')
    ) then
      raise exception 'coupon code already used by this user';
    end if;
  end if;

  insert into deposit_requests(
    ticket_id,
    user_id,
    wallet_id,
    amount_usdt,
    network,
    admin_wallet_address,
    proof_path,
    coupon_code,
    coupon_reward_usdt
  )
  values (
    p_ticket_id,
    p_user_id,
    p_wallet_id,
    p_amount_usdt,
    p_network,
    p_admin_wallet_address,
    p_proof_path,
    v_coupon_code,
    coalesce(v_coupon.reward_usdt, 0)
  )
  returning id into v_deposit_id;

  if v_coupon_code is not null then
    insert into coupon_redemptions(coupon_code, user_id, deposit_request_id, reward_usdt)
    values (v_coupon_code, p_user_id, v_deposit_id, v_coupon.reward_usdt);
  end if;

  return v_deposit_id;
end;
$$;

revoke execute on function create_deposit_request(text, uuid, uuid, numeric, text, text, text, text) from public;
revoke execute on function create_deposit_request(text, uuid, uuid, numeric, text, text, text, text) from anon;
revoke execute on function create_deposit_request(text, uuid, uuid, numeric, text, text, text, text) from authenticated;
grant execute on function create_deposit_request(text, uuid, uuid, numeric, text, text, text, text) to service_role;

create or replace function create_sell_order(p_ticket_id text, p_amount_usdt numeric, p_payment_method_id uuid, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  select id into v_order_id from orders where user_id = v_user and idempotency_key = p_idempotency_key;
  if v_order_id is not null then return v_order_id; end if;

  if exists (
    select 1
    from deposit_requests
    where user_id = v_user
      and status = 'PENDING_DEPOSIT'
  ) or exists (
    select 1
    from orders
    where user_id = v_user
      and status in ('PENDING_DEPOSIT','DEPOSIT_DETECTED','DEPOSIT_CONFIRMED','PROCESSING_PAYOUT','PAYOUT_SENT')
  ) then
    raise exception 'you already have an active order. please wait until it is completed before placing another.';
  end if;

  if p_payment_method_id is null then
    v_payment_snapshot := jsonb_build_object('type', 'qr', 'display_name', 'Digital Erupee');
  else
    select * into v_method
    from payment_methods
    where id = p_payment_method_id
      and user_id = v_user
      and status = 'active'
      and type <> 'qr';

    if not found then raise exception 'invalid payment method'; end if;

    v_payment_snapshot := to_jsonb(v_method) - 'account_number' || jsonb_build_object(
      'account_number_masked',
      case when v_method.account_number is null then null else right(v_method.account_number, 4) end
    );
  end if;

  v_gross := round(p_amount_usdt * v_settings.usdt_inr_rate, 2);
  v_net := v_gross;

  select coalesce(max(queue_position), 0) + 1
  into v_queue
  from orders
  where status in ('PENDING_DEPOSIT','DEPOSIT_DETECTED','DEPOSIT_CONFIRMED','PROCESSING_PAYOUT');

  insert into orders(
    ticket_id,
    idempotency_key,
    user_id,
    wallet_id,
    amount_usdt,
    rate,
    gross_inr,
    fees,
    net_inr,
    payment_method_id,
    payment_method_snapshot,
    status,
    queue_position
  )
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

  update wallets
  set available_balance = available_balance - p_amount_usdt,
      locked_balance = locked_balance + p_amount_usdt
  where id = v_wallet.id;

  insert into wallet_ledger(wallet_id, type, amount, reference_type, reference_id, balance_before, balance_after)
  values (v_wallet.id, 'LOCK', p_amount_usdt, 'order', v_order_id, v_wallet.available_balance, v_wallet.available_balance - p_amount_usdt);

  insert into order_status_history(order_id, status, actor_id, note)
  values (v_order_id, 'PENDING_DEPOSIT', v_user, 'Order created');

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (v_user, 'ORDER_CREATED', 'order', v_order_id::text, jsonb_build_object('ticket_id', p_ticket_id));

  return v_order_id;
end;
$$;

revoke execute on function create_sell_order(text, numeric, uuid, uuid) from public;
revoke execute on function create_sell_order(text, numeric, uuid, uuid) from anon;
grant execute on function create_sell_order(text, numeric, uuid, uuid) to authenticated;

drop view if exists platform_settings_decrypted;
create view platform_settings_decrypted
with (security_invoker = true)
as
select
  id,
  usdt_inr_rate,
  platform_fee_percent,
  min_sell_amount,
  min_deposit_amount,
  max_sell_amount,
  coalesce(private.decrypt_text(admin_wallet_address_encrypted), admin_wallet_address) as admin_wallet_address,
  private.decrypt_text(admin_wallet_qr_path_encrypted) as admin_wallet_qr_path,
  supported_network,
  processing_message,
  maintenance_mode,
  updated_at
from platform_settings;

drop view if exists deposit_requests_decrypted;
create view deposit_requests_decrypted
with (security_invoker = true)
as
select
  id,
  ticket_id,
  user_id,
  wallet_id,
  amount_usdt,
  network,
  coalesce(private.decrypt_text(admin_wallet_address_encrypted), admin_wallet_address) as admin_wallet_address,
  proof_path,
  status,
  admin_id,
  admin_notes,
  rejection_reason,
  created_at,
  verified_at,
  coupon_code,
  coupon_reward_usdt
from deposit_requests;

drop view if exists transactions_decrypted;
create view transactions_decrypted
with (security_invoker = true)
as
select
  id,
  order_id,
  private.decrypt_text(tx_hash_encrypted) as tx_hash,
  private.decrypt_text(network_encrypted) as network,
  nullif(private.decrypt_text(amount_encrypted), '')::numeric(28, 8) as amount,
  status,
  created_at
from transactions;

grant select on platform_settings_decrypted to authenticated;
grant select on deposit_requests_decrypted to authenticated;
grant select on transactions_decrypted to authenticated;
grant select on platform_settings_decrypted to service_role;
grant select on deposit_requests_decrypted to service_role;
grant select on transactions_decrypted to service_role;
