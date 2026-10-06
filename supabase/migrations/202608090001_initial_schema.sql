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
