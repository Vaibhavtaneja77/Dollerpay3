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
