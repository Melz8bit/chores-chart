-- get_kiosk_board was DROP + CREATE'd in 0015 to change its return columns,
-- which resets its grants to Postgres/Supabase defaults (EXECUTE to PUBLIC,
-- which on this project also manifests as a direct anon grant — see
-- 0010/0011 history). Re-apply the lockdown here, in a separate later
-- migration, since revoking in the same migration that creates/drops the
-- function did not stick for anon last time (confirmed via pg_proc.proacl
-- introspection during 0010/0011).
revoke execute on function public.get_kiosk_board() from public;
revoke execute on function public.get_kiosk_board() from anon;
