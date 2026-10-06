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
