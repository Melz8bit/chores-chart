-- Real root cause, found via pg_proc.proacl introspection (not just
-- has_function_privilege, which was misleading me): these three functions
-- still carry a plain PUBLIC execute grant (`=X` in the ACL) that was never
-- revoked — 0012/0013 only revoked from `anon`/`authenticated` specifically,
-- based on a wrong theory that Postgres/Supabase grants EXECUTE directly to
-- those roles rather than via PUBLIC. Comparing against expire_unused_points
-- (correctly locked down, no `=X` in its ACL, because 0009 revoked
-- `from public` for it directly) makes the actual mechanism clear: this was
-- always a plain PUBLIC grant, exactly as originally suspected in 0010 —
-- revoking from `anon`/`authenticated` alone was never going to be enough
-- while the PUBLIC grant remained.

revoke execute on function public.get_points_history(int) from public;
revoke execute on function public.get_dashboard_insights() from public;
revoke execute on function public.chore_period_history(uuid, int) from public;
