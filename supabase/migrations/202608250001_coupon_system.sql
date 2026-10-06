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
