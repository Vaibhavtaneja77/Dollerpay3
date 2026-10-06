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
