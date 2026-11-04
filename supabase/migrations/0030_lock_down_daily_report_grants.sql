-- Lock down the 0029 functions (separate migration, same as the earlier
-- lock-downs: revokes from anon only stick once the function exists).
-- get_daily_report takes any family id, so only the service role (send-push)
-- may call it; send_daily_reports is pg_cron's job, not a client action.
revoke execute on function public.get_daily_report(uuid) from public, anon, authenticated;
revoke execute on function public.send_daily_reports() from public, anon, authenticated;
