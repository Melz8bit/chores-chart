-- Same lock-down pattern as the earlier grant migrations: signed-in parents
-- only, never anon.
revoke execute on function public.set_daily_report(boolean) from public, anon;
