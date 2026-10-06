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
