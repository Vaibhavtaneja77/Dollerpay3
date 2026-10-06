create extension if not exists pgcrypto;

create type user_role as enum ('customer', 'admin');
create type account_status as enum ('active', 'banned');
create type payment_method_type as enum ('upi', 'bank');
create type order_status as enum ('PENDING_DEPOSIT','DEPOSIT_DETECTED','DEPOSIT_CONFIRMED','PROCESSING_PAYOUT','PAYOUT_SENT','COMPLETED','REJECTED','CANCELLED','EXPIRED');
create type ledger_type as enum ('DEPOSIT','LOCK','UNLOCK','SETTLEMENT','ADJUSTMENT','REVERSAL');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null unique,
  role user_role not null default 'customer',
  status account_status not null default 'active',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  address text not null unique,
  available_balance numeric(28, 8) not null default 0 check (available_balance >= 0),
  locked_balance numeric(28, 8) not null default 0 check (locked_balance >= 0),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id) on delete restrict,
  type ledger_type not null,
  amount numeric(28, 8) not null check (amount > 0),
  reference_type text not null,
  reference_id uuid,
  balance_before numeric(28, 8) not null,
  balance_after numeric(28, 8) not null,
  created_at timestamptz not null default now()
);

create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type payment_method_type not null,
  display_name text,
  upi_id text,
  qr_path text,
  account_holder_name text,
  bank_name text,
  account_number text,
  ifsc text,
  is_default boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint valid_upi check (
    type <> 'upi'
    or (
      upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z]+$'
      and length(split_part(upi_id, '@', 1)) between 2 and 256
      and length(split_part(upi_id, '@', 2)) between 2 and 64
    )
  ),
  constraint valid_bank check (
    type <> 'bank'
    or (
      account_holder_name is not null
      and length(trim(account_holder_name)) >= 2
      and bank_name is not null
      and length(trim(bank_name)) >= 2
      and account_number ~ '^[0-9]{9,18}$'
      and ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'
    )
  )
);

create unique index one_default_payment_method_per_user on payment_methods(user_id) where is_default;
create unique index unique_upi_per_user on payment_methods(user_id, lower(upi_id)) where type = 'upi';
create unique index unique_bank_per_user on payment_methods(user_id, account_number, ifsc) where type = 'bank';

create table platform_settings (
  id integer primary key default 1 check (id = 1),
  usdt_inr_rate numeric(18, 4) not null check (usdt_inr_rate > 0),
  platform_fee_percent numeric(8, 4) not null default 0 check (platform_fee_percent >= 0 and platform_fee_percent <= 25),
  min_sell_amount numeric(28, 8) not null default 1 check (min_sell_amount > 0),
  max_sell_amount numeric(28, 8) not null default 10000 check (max_sell_amount >= min_sell_amount),
  admin_wallet_address text not null,
  supported_network text not null,
  processing_message text not null default 'Within 24 hours',
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into platform_settings (id, usdt_inr_rate, platform_fee_percent, admin_wallet_address, supported_network)
values (1, 91.50, 0.50, 'CONFIGURE_ADMIN_USDT_WALLET', 'USDT - TRC20')
on conflict (id) do nothing;

create table orders (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null unique,
  idempotency_key uuid not null,
  user_id uuid not null references profiles(id) on delete restrict,
  wallet_id uuid not null references wallets(id) on delete restrict,
  amount_usdt numeric(28, 8) not null check (amount_usdt > 0),
  rate numeric(18, 4) not null check (rate > 0),
  gross_inr numeric(28, 2) not null check (gross_inr >= 0),
  fees numeric(28, 2) not null check (fees >= 0),
  net_inr numeric(28, 2) not null check (net_inr >= 0),
  payment_method_id uuid not null references payment_methods(id) on delete restrict,
  payment_method_snapshot jsonb not null,
  status order_status not null default 'PENDING_DEPOSIT',
  queue_position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  admin_id uuid references profiles(id),
  admin_notes text,
  payment_proof_path text,
  rejection_reason text,
  completed_at timestamptz,
  lock_version integer not null default 0,
  unique (user_id, idempotency_key)
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  actor_id uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  tx_hash text unique,
  network text,
  amount numeric(28,8),
  status text not null default 'unverified',
  created_at timestamptz not null default now()
);

create table payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table admin_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  admin_id uuid not null references profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index orders_user_id_idx on orders(user_id);
create index orders_status_idx on orders(status);
create index orders_created_at_idx on orders(created_at desc);
create index orders_ticket_id_idx on orders(ticket_id);
create index payment_methods_user_id_idx on payment_methods(user_id);
create index wallet_ledger_wallet_id_idx on wallet_ledger(wallet_id);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active')
$$;

create or replace function create_profile_for_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, email, full_name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure create_profile_for_auth_user();

create or replace function prevent_customer_profile_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.id and not is_admin() then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;

create trigger prevent_customer_profile_escalation_trigger
before update on profiles
for each row execute procedure prevent_customer_profile_escalation();

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
  values (p_ticket_id, p_idempotency_key, v_user, v_wallet.id, p_amount_usdt, v_settings.usdt_inr_rate, v_gross, v_fees, v_net, p_payment_method_id, to_jsonb(v_method) - 'account_number' || jsonb_build_object('account_number_masked', right(v_method.account_number, 4)), 'PENDING_DEPOSIT', v_queue)
  returning id into v_order_id;

  update wallets set available_balance = available_balance - p_amount_usdt, locked_balance = locked_balance + p_amount_usdt where id = v_wallet.id;
  insert into wallet_ledger(wallet_id, type, amount, reference_type, reference_id, balance_before, balance_after)
  values (v_wallet.id, 'LOCK', p_amount_usdt, 'order', v_order_id, v_wallet.available_balance, v_wallet.available_balance - p_amount_usdt);
  insert into order_status_history(order_id, status, actor_id, note) values (v_order_id, 'PENDING_DEPOSIT', v_user, 'Order created');
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata) values (v_user, 'ORDER_CREATED', 'order', v_order_id::text, jsonb_build_object('ticket_id', p_ticket_id));
  return v_order_id;
end;
$$;

create or replace function transition_order_status(p_order_id uuid, p_next_status order_status, p_admin_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current order_status;
begin
  if not is_admin() then raise exception 'admin required'; end if;
  select status into v_current from orders where id = p_order_id for update;
  if p_next_status = 'PROCESSING_PAYOUT' and v_current not in ('DEPOSIT_CONFIRMED','PENDING_DEPOSIT','DEPOSIT_DETECTED') then
    raise exception 'invalid state transition';
  end if;
  update orders set status = p_next_status, admin_id = p_admin_id, admin_notes = coalesce(p_note, admin_notes), updated_at = now(), lock_version = lock_version + 1 where id = p_order_id;
  insert into order_status_history(order_id, status, actor_id, note) values (p_order_id, p_next_status, p_admin_id, p_note);
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata) values (p_admin_id, 'ORDER_STATUS_CHANGED', 'order', p_order_id::text, jsonb_build_object('status', p_next_status));
end;
$$;

create or replace function complete_sell_order(p_order_id uuid, p_admin_id uuid, p_payment_proof_path text, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_wallet wallets%rowtype;
begin
  if not is_admin() then raise exception 'admin required'; end if;
  select * into v_order from orders where id = p_order_id for update;
  if v_order.status not in ('PROCESSING_PAYOUT','PAYOUT_SENT') then raise exception 'invalid state transition'; end if;
  select * into v_wallet from wallets where id = v_order.wallet_id for update;
  if v_wallet.locked_balance < v_order.amount_usdt then raise exception 'locked balance mismatch'; end if;
  insert into wallet_ledger(wallet_id, type, amount, reference_type, reference_id, balance_before, balance_after)
  values (v_wallet.id, 'SETTLEMENT', v_order.amount_usdt, 'order', p_order_id, v_wallet.locked_balance, v_wallet.locked_balance - v_order.amount_usdt);
  update wallets set locked_balance = locked_balance - v_order.amount_usdt where id = v_order.wallet_id;
  update orders set status = 'COMPLETED', admin_id = p_admin_id, payment_proof_path = p_payment_proof_path, completed_at = now(), updated_at = now(), lock_version = lock_version + 1 where id = p_order_id;
  insert into payment_proofs(order_id, uploaded_by, storage_path) values (p_order_id, p_admin_id, p_payment_proof_path);
  insert into order_status_history(order_id, status, actor_id, note) values (p_order_id, 'COMPLETED', p_admin_id, p_note);
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata) values (p_admin_id, 'ORDER_COMPLETED', 'order', p_order_id::text, jsonb_build_object('proof', p_payment_proof_path));
end;
$$;

create or replace function reject_sell_order(p_order_id uuid, p_admin_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_wallet wallets%rowtype;
begin
  if not is_admin() then raise exception 'admin required'; end if;
  select * into v_order from orders where id = p_order_id for update;
  if v_order.status in ('COMPLETED','REJECTED','CANCELLED') then raise exception 'invalid state transition'; end if;
  select * into v_wallet from wallets where id = v_order.wallet_id for update;
  if v_wallet.locked_balance < v_order.amount_usdt then raise exception 'locked balance mismatch'; end if;
  insert into wallet_ledger(wallet_id, type, amount, reference_type, reference_id, balance_before, balance_after)
  values (v_wallet.id, 'UNLOCK', v_order.amount_usdt, 'order', p_order_id, v_wallet.available_balance, v_wallet.available_balance + v_order.amount_usdt);
  update wallets set available_balance = available_balance + v_order.amount_usdt, locked_balance = locked_balance - v_order.amount_usdt where id = v_order.wallet_id;
  update orders set status = 'REJECTED', admin_id = p_admin_id, rejection_reason = p_reason, updated_at = now(), lock_version = lock_version + 1 where id = p_order_id;
  insert into order_status_history(order_id, status, actor_id, note) values (p_order_id, 'REJECTED', p_admin_id, p_reason);
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata) values (p_admin_id, 'ORDER_REJECTED', 'order', p_order_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function set_user_ban_status(p_target_user_id uuid, p_banned boolean, p_admin_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin required'; end if;
  update profiles set status = case when p_banned then 'banned'::account_status else 'active'::account_status end where id = p_target_user_id and role = 'customer';
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (p_admin_id, case when p_banned then 'USER_BANNED' else 'USER_UNBANNED' end, 'profile', p_target_user_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

alter table profiles enable row level security;
alter table wallets enable row level security;
alter table wallet_ledger enable row level security;
alter table payment_methods enable row level security;
alter table orders enable row level security;
alter table order_status_history enable row level security;
alter table transactions enable row level security;
alter table payment_proofs enable row level security;
alter table admin_notes enable row level security;
alter table audit_logs enable row level security;
alter table platform_settings enable row level security;

create policy profiles_select_own_or_admin on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_update_own_limited on profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = 'customer');
create policy profiles_insert_own on profiles for insert with check (id = auth.uid() and role = 'customer' and status = 'active');
create policy admin_all_profiles on profiles for all using (is_admin()) with check (is_admin());

create policy wallets_own_or_admin on wallets for select using (user_id = auth.uid() or is_admin());
create policy wallets_insert_own on wallets for insert with check (user_id = auth.uid());

create policy ledger_own_or_admin on wallet_ledger for select using (exists(select 1 from wallets where wallets.id = wallet_ledger.wallet_id and (wallets.user_id = auth.uid() or is_admin())));

create policy payment_methods_own_or_admin on payment_methods for select using (user_id = auth.uid() or is_admin());
create policy payment_methods_insert_own on payment_methods for insert with check (user_id = auth.uid());
create policy payment_methods_update_own on payment_methods for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy payment_methods_delete_own on payment_methods for delete using (user_id = auth.uid());

create policy orders_own_or_admin on orders for select using (user_id = auth.uid() or is_admin());
create policy order_history_own_or_admin on order_status_history for select using (exists(select 1 from orders where orders.id = order_status_history.order_id and (orders.user_id = auth.uid() or is_admin())));
create policy transactions_own_or_admin on transactions for select using (exists(select 1 from orders where orders.id = transactions.order_id and (orders.user_id = auth.uid() or is_admin())));
create policy proofs_own_or_admin on payment_proofs for select using (exists(select 1 from orders where orders.id = payment_proofs.order_id and (orders.user_id = auth.uid() or is_admin())));
create policy admin_notes_admin_only on admin_notes for all using (is_admin()) with check (is_admin());
create policy audit_admin_only on audit_logs for all using (is_admin()) with check (is_admin());
create policy settings_read_authenticated on platform_settings for select using (auth.uid() is not null);
create policy settings_admin_update on platform_settings for update using (is_admin()) with check (is_admin());

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

create policy payment_proof_upload_admin on storage.objects
for insert with check (bucket_id = 'payment-proofs' and is_admin());

create policy payment_proof_read_admin on storage.objects
for select using (bucket_id = 'payment-proofs' and is_admin());

revoke execute on function create_sell_order(text, numeric, uuid, uuid) from public;
revoke execute on function transition_order_status(uuid, order_status, uuid, text) from public;
revoke execute on function complete_sell_order(uuid, uuid, text, text) from public;
revoke execute on function reject_sell_order(uuid, uuid, text) from public;
revoke execute on function set_user_ban_status(uuid, boolean, uuid, text) from public;

grant execute on function create_sell_order(text, numeric, uuid, uuid) to authenticated;
grant execute on function transition_order_status(uuid, order_status, uuid, text) to authenticated;
grant execute on function complete_sell_order(uuid, uuid, text, text) to authenticated;
grant execute on function reject_sell_order(uuid, uuid, text) to authenticated;
grant execute on function set_user_ban_status(uuid, boolean, uuid, text) to authenticated;
create table if not exists admin_email_allowlist (
  email text primary key,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  constraint admin_email_allowlist_email_format check (
    email = lower(email)
    and email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  )
);

alter table admin_email_allowlist enable row level security;

drop trigger if exists prevent_customer_profile_escalation_trigger on profiles;
drop function if exists prevent_customer_profile_escalation();

drop policy if exists profiles_update_own_limited on profiles;
create policy profiles_update_own_limited on profiles
for update
using (id = auth.uid() and role = 'customer' and status = 'active')
with check (id = auth.uid() and role = 'customer' and status = 'active');

create policy admin_email_allowlist_admin_select on admin_email_allowlist
for select using (is_admin());

create policy admin_email_allowlist_admin_insert on admin_email_allowlist
for insert with check (is_admin());

create policy admin_email_allowlist_admin_delete on admin_email_allowlist
for delete using (is_admin());

create or replace function is_admin_email(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from admin_email_allowlist
    where email = lower(trim(p_email))
  )
$$;

create or replace function create_profile_for_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(new.email, '')));
  v_is_verified boolean := new.email_confirmed_at is not null;
  v_role user_role := 'customer';
begin
  if v_is_verified and is_admin_email(v_email) then
    v_role := 'admin';
  end if;

  insert into profiles(id, email, full_name, role, onboarding_completed)
  values (
    new.id,
    v_email,
    new.raw_user_meta_data->>'full_name',
    v_role,
    v_role = 'admin'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(profiles.full_name, excluded.full_name),
        role = case
          when v_is_verified and is_admin_email(v_email) then 'admin'::user_role
          else profiles.role
        end,
        onboarding_completed = case
          when v_is_verified and is_admin_email(v_email) then true
          else profiles.onboarding_completed
        end;

  return new;
end;
$$;

create or replace function sync_admin_profiles_from_allowlist() returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles
  set role = 'admin',
      status = 'active',
      onboarding_completed = true
  where lower(email) in (select email from admin_email_allowlist);
end;
$$;

create or replace function promote_profile_for_admin_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles
  set role = 'admin',
      status = 'active',
      onboarding_completed = true
  where lower(email) = new.email;

  return new;
end;
$$;

drop trigger if exists promote_profile_for_admin_email_trigger on admin_email_allowlist;
create trigger promote_profile_for_admin_email_trigger
after insert on admin_email_allowlist
for each row execute procedure promote_profile_for_admin_email();

-- Replace this with your real Google OAuth admin email before applying,
-- or run the insert manually after the migration is applied.
insert into admin_email_allowlist (email)
values ('vishal.codesman@gmail.com')
on conflict (email) do nothing;

select sync_admin_profiles_from_allowlist();

revoke execute on function is_admin_email(text) from public;
revoke execute on function sync_admin_profiles_from_allowlist() from public;
revoke execute on function promote_profile_for_admin_email() from public;
alter table payment_methods
drop constraint if exists valid_upi;

alter table payment_methods
drop constraint if exists valid_bank;

alter table payment_methods
add constraint valid_upi check (
  type <> 'upi'
  or (
    upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z]+$'
    and length(split_part(upi_id, '@', 1)) between 2 and 256
    and length(split_part(upi_id, '@', 2)) between 2 and 64
  )
);

alter table payment_methods
add constraint valid_bank check (
  type <> 'bank'
  or (
    account_holder_name is not null
    and length(trim(account_holder_name)) >= 2
    and bank_name is not null
    and length(trim(bank_name)) >= 2
    and account_number ~ '^[0-9]{9,18}$'
    and ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'
  )
);
alter table payment_methods
drop constraint if exists valid_upi;

alter table payment_methods
add constraint valid_upi check (
  type <> 'upi'
  or (
    upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z]+$'
    and length(split_part(upi_id, '@', 1)) between 2 and 256
    and length(split_part(upi_id, '@', 2)) between 2 and 64
  )
);
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
alter type payment_method_type add value if not exists 'qr';

alter type deposit_request_status add value if not exists 'EXPIRED';
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
create type referral_status as enum ('REGISTERED', 'READY_FOR_PAYOUT', 'PAID', 'REJECTED', 'LIMIT_REACHED');

alter table profiles add column if not exists referral_code text;

create or replace function generate_referral_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists(select 1 from profiles where referral_code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function assign_referral_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.referral_code is null or length(trim(new.referral_code)) = 0 then
    new.referral_code := generate_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists assign_referral_code_trigger on profiles;
create trigger assign_referral_code_trigger
before insert on profiles
for each row execute procedure assign_referral_code();

update profiles
set referral_code = generate_referral_code()
where referral_code is null;

alter table profiles alter column referral_code set not null;
create unique index if not exists profiles_referral_code_key on profiles(referral_code);

create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_user_id uuid not null unique references profiles(id) on delete cascade,
  status referral_status not null default 'REGISTERED',
  reward_amount_inr numeric(28, 2) not null default 500 check (reward_amount_inr > 0),
  qualified_deposit_amount_usdt numeric(28, 8),
  qualified_at timestamptz,
  paid_at timestamptz,
  admin_id uuid references profiles(id),
  admin_note text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referrals_no_self_referral check (referrer_id <> referred_user_id)
);

create index referrals_referrer_id_idx on referrals(referrer_id, created_at desc);
create index referrals_referred_user_id_idx on referrals(referred_user_id);
create index referrals_status_idx on referrals(status);

alter table referrals enable row level security;

create policy referrals_own_or_admin on referrals
for select using (referrer_id = auth.uid() or referred_user_id = auth.uid() or is_admin());

create or replace function register_referral(p_referral_code text, p_referred_user_id uuid default auth.uid())
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_referral_id uuid;
begin
  if p_referred_user_id is null then raise exception 'not authenticated'; end if;
  if p_referral_code is null or length(trim(p_referral_code)) = 0 then raise exception 'referral code is required'; end if;

  select id into v_referrer_id
  from profiles
  where referral_code = upper(trim(p_referral_code))
    and role = 'customer'
    and status = 'active';

  if not found then raise exception 'invalid referral code'; end if;
  if v_referrer_id = p_referred_user_id then raise exception 'self referral is not allowed'; end if;

  select id into v_referral_id
  from referrals
  where referred_user_id = p_referred_user_id;

  if v_referral_id is not null then
    return v_referral_id;
  end if;

  insert into referrals(referrer_id, referred_user_id)
  values (v_referrer_id, p_referred_user_id)
  returning id into v_referral_id;

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (p_referred_user_id, 'REFERRAL_REGISTERED', 'referral', v_referral_id::text, jsonb_build_object('referrer_id', v_referrer_id));

  perform refresh_referrals_for_referrer(v_referrer_id);

  return v_referral_id;
end;
$$;

create or replace function refresh_referrals_for_referrer(p_referrer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid_count integer := 0;
  v_slots integer := 0;
  v_row record;
  v_updated integer := 0;
begin
  if p_referrer_id is null then
    return 0;
  end if;

  select count(*) into v_paid_count
  from referrals
  where referrer_id = p_referrer_id
    and status = 'PAID';

  v_slots := greatest(0, 5 - v_paid_count);

  for v_row in
    with referral_totals as (
      select
        r.id,
        r.status,
        r.created_at,
        coalesce(sum(case when d.status = 'DEPOSIT_CONFIRMED' then d.amount_usdt else 0 end), 0) as confirmed_total
      from referrals r
      left join deposit_requests d on d.user_id = r.referred_user_id
      where r.referrer_id = p_referrer_id
        and r.status <> 'PAID'
        and r.status <> 'REJECTED'
      group by r.id, r.status, r.created_at
    ),
    ranked as (
      select
        *,
        case
          when confirmed_total >= 500
            then row_number() over (partition by (confirmed_total >= 500) order by created_at asc, id asc)
          else null
        end as qualifying_rank
      from referral_totals
    )
    select *
    from ranked
    order by created_at asc, id asc
  loop
    if v_row.confirmed_total < 500 then
      if v_row.status <> 'REGISTERED' then
        update referrals
        set status = 'REGISTERED',
            qualified_at = null,
            qualified_deposit_amount_usdt = null,
            admin_id = null,
            admin_note = null,
            rejection_reason = null,
            updated_at = now()
        where id = v_row.id;
        v_updated := v_updated + 1;
      end if;
    elsif v_row.qualifying_rank is not null and v_row.qualifying_rank <= v_slots then
      update referrals
      set status = 'READY_FOR_PAYOUT',
          qualified_at = coalesce(qualified_at, now()),
          qualified_deposit_amount_usdt = v_row.confirmed_total,
          updated_at = now()
      where id = v_row.id
        and (status <> 'READY_FOR_PAYOUT' or qualified_deposit_amount_usdt is distinct from v_row.confirmed_total);
      if found then v_updated := v_updated + 1; end if;
    else
      update referrals
      set status = 'LIMIT_REACHED',
          qualified_at = coalesce(qualified_at, now()),
          qualified_deposit_amount_usdt = v_row.confirmed_total,
          updated_at = now()
      where id = v_row.id
        and (status <> 'LIMIT_REACHED' or qualified_deposit_amount_usdt is distinct from v_row.confirmed_total);
      if found then v_updated := v_updated + 1; end if;
    end if;
  end loop;

  return v_updated;
end;
$$;

create or replace function refresh_referrals_for_referred_user(p_referred_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
begin
  select referrer_id into v_referrer_id
  from referrals
  where referred_user_id = p_referred_user_id;

  if v_referrer_id is null then
    return 0;
  end if;

  return refresh_referrals_for_referrer(v_referrer_id);
end;
$$;

create or replace function mark_referral_paid(p_referral_id uuid, p_admin_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral referrals%rowtype;
begin
  if not is_admin() then raise exception 'admin required'; end if;

  select * into v_referral
  from referrals
  where id = p_referral_id
  for update;

  if not found then raise exception 'referral not found'; end if;
  if v_referral.status <> 'READY_FOR_PAYOUT' then raise exception 'referral is not ready for payout'; end if;

  update referrals
  set status = 'PAID',
      admin_id = p_admin_id,
      admin_note = nullif(trim(p_note), ''),
      paid_at = now(),
      updated_at = now()
  where id = p_referral_id;

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (p_admin_id, 'REFERRAL_PAID', 'referral', p_referral_id::text, jsonb_build_object('reward_amount_inr', v_referral.reward_amount_inr));
end;
$$;

create or replace function reject_referral_reward(p_referral_id uuid, p_admin_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral referrals%rowtype;
  v_clean_reason text := nullif(trim(p_reason), '');
begin
  if not is_admin() then raise exception 'admin required'; end if;
  if v_clean_reason is null or char_length(v_clean_reason) < 8 then raise exception 'rejection reason is required'; end if;

  select * into v_referral
  from referrals
  where id = p_referral_id
  for update;

  if not found then raise exception 'referral not found'; end if;
  if v_referral.status <> 'READY_FOR_PAYOUT' then raise exception 'referral is not ready for payout'; end if;

  update referrals
  set status = 'REJECTED',
      admin_id = p_admin_id,
      rejection_reason = v_clean_reason,
      updated_at = now()
  where id = p_referral_id;

  perform refresh_referrals_for_referrer(v_referral.referrer_id);

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (p_admin_id, 'REFERRAL_REJECTED', 'referral', p_referral_id::text, jsonb_build_object('reason', v_clean_reason));
end;
$$;

revoke execute on function register_referral(text, uuid) from public;
revoke execute on function refresh_referrals_for_referrer(uuid) from public;
revoke execute on function refresh_referrals_for_referred_user(uuid) from public;
revoke execute on function mark_referral_paid(uuid, uuid, text) from public;
revoke execute on function reject_referral_reward(uuid, uuid, text) from public;

grant execute on function register_referral(text, uuid) to authenticated;
grant execute on function refresh_referrals_for_referrer(uuid) to authenticated;
grant execute on function refresh_referrals_for_referred_user(uuid) to authenticated;
grant execute on function mark_referral_paid(uuid, uuid, text) to authenticated;
grant execute on function reject_referral_reward(uuid, uuid, text) to authenticated;
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
drop function if exists expire_pending_deposit_requests(uuid);

create or replace function expire_pending_deposit_requests(p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  return;
end;
$$;

revoke execute on function expire_pending_deposit_requests(uuid) from public;
revoke execute on function expire_pending_deposit_requests(uuid) from anon;
revoke execute on function expire_pending_deposit_requests(uuid) from authenticated;
grant execute on function expire_pending_deposit_requests(uuid) to service_role;
drop function if exists expire_pending_sell_orders(uuid);

create or replace function expire_pending_sell_orders(p_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return 0;
end;
$$;

revoke execute on function expire_pending_sell_orders(uuid) from public;
revoke execute on function expire_pending_sell_orders(uuid) from anon;
revoke execute on function expire_pending_sell_orders(uuid) from authenticated;
grant execute on function expire_pending_sell_orders(uuid) to service_role;
update storage.buckets
set file_size_limit = 52428800
where id = 'payment-proofs';
create table if not exists coupons (
  code text primary key,
  reward_usdt numeric(28, 8) not null check (reward_usdt > 0),
  max_redemptions integer not null check (max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  constraint coupons_code_format check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,40}$')
);

alter table coupons enable row level security;
alter table coupons force row level security;

drop policy if exists coupons_admin_select on coupons;
drop policy if exists coupons_service_insert on coupons;
drop policy if exists coupons_service_delete on coupons;
create policy coupons_admin_select on coupons for select using (is_admin());
create policy coupons_service_insert on coupons for insert with check (auth.role() = 'service_role');
create policy coupons_service_delete on coupons for delete using (auth.role() = 'service_role');

create table if not exists coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_code text not null,
  user_id uuid not null references profiles(id) on delete restrict,
  deposit_request_id uuid not null unique references deposit_requests(id) on delete cascade,
  reward_usdt numeric(28, 8) not null check (reward_usdt > 0),
  status text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','REJECTED')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  rejected_at timestamptz
);

create unique index if not exists coupon_redemptions_one_active_coupon_per_user_idx
on coupon_redemptions(coupon_code, user_id)
where status in ('PENDING','CONFIRMED');

create unique index if not exists coupon_redemptions_one_pending_coupon_per_user_idx
on coupon_redemptions(user_id)
where status = 'PENDING';

create index if not exists coupon_redemptions_coupon_code_idx on coupon_redemptions(coupon_code);
create index if not exists coupon_redemptions_user_id_idx on coupon_redemptions(user_id);

alter table coupon_redemptions enable row level security;
alter table coupon_redemptions force row level security;

drop policy if exists coupon_redemptions_own_or_admin_select on coupon_redemptions;
drop policy if exists coupon_redemptions_service_write on coupon_redemptions;
create policy coupon_redemptions_own_or_admin_select on coupon_redemptions
for select using (user_id = auth.uid() or is_admin());
create policy coupon_redemptions_service_write on coupon_redemptions
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

alter table deposit_requests add column if not exists coupon_code text;
alter table deposit_requests add column if not exists coupon_reward_usdt numeric(28, 8) not null default 0 check (coupon_reward_usdt >= 0);

create or replace function create_deposit_request(
  p_ticket_id text,
  p_user_id uuid,
  p_wallet_id uuid,
  p_amount_usdt numeric,
  p_network text,
  p_admin_wallet_address text,
  p_proof_path text,
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
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if p_amount_usdt <= 0 then raise exception 'invalid deposit amount'; end if;

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

create or replace function verify_deposit_request(p_deposit_id uuid, p_admin_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_deposit deposit_requests%rowtype;
  v_wallet wallets%rowtype;
  v_reward numeric(28, 8) := 0;
  v_after_deposit numeric(28, 8);
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

  v_reward := coalesce(v_deposit.coupon_reward_usdt, 0);
  v_after_deposit := v_wallet.available_balance + v_deposit.amount_usdt;

  update wallets
  set available_balance = available_balance + v_deposit.amount_usdt + v_reward
  where id = v_wallet.id;

  insert into wallet_ledger(wallet_id, type, amount, reference_type, reference_id, balance_before, balance_after)
  values (
    v_wallet.id,
    'DEPOSIT',
    v_deposit.amount_usdt,
    'deposit_request',
    v_deposit.id,
    v_wallet.available_balance,
    v_after_deposit
  );

  if v_reward > 0 then
    insert into wallet_ledger(wallet_id, type, amount, reference_type, reference_id, balance_before, balance_after)
    values (
      v_wallet.id,
      'ADJUSTMENT',
      v_reward,
      'coupon_reward',
      v_deposit.id,
      v_after_deposit,
      v_after_deposit + v_reward
    );

    update coupon_redemptions
    set status = 'CONFIRMED',
        confirmed_at = now()
    where deposit_request_id = p_deposit_id
      and status = 'PENDING';

    update coupons
    set redeemed_count = redeemed_count + 1
    where code = v_deposit.coupon_code;
  end if;

  update deposit_requests
  set status = 'DEPOSIT_CONFIRMED',
      admin_id = p_admin_id,
      admin_notes = p_note,
      verified_at = now()
  where id = p_deposit_id;

  perform refresh_referrals_for_referred_user(v_deposit.user_id);

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    p_admin_id,
    'DEPOSIT_CONFIRMED',
    'deposit_request',
    p_deposit_id::text,
    jsonb_build_object('amount_usdt', v_deposit.amount_usdt, 'coupon_code', v_deposit.coupon_code, 'coupon_reward_usdt', v_reward)
  );
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

  update coupon_redemptions
  set status = 'REJECTED',
      rejected_at = now()
  where deposit_request_id = p_deposit_id
    and status = 'PENDING';

  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (p_admin_id, 'DEPOSIT_REJECTED', 'deposit_request', p_deposit_id::text, jsonb_build_object('reason', p_reason));
end;
$$;
