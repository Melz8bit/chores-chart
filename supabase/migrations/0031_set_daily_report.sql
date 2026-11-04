-- family_members updates are column-limited (0003), so the client can't
-- write daily_report (0029) directly. Rather than granting the column (RLS
-- would then let a parent flip the *other* parent's opt-in), this RPC only
-- ever changes the caller's own row. Grants are re-locked in 0032.
create function public.set_daily_report(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.family_members
  set daily_report = p_enabled
  where auth_user_id = auth.uid() and kind = 'parent';

  if not found then
    raise exception 'Only a parent account can change the daily report setting';
  end if;
end;
$$;

grant execute on function public.set_daily_report(boolean) to authenticated;
