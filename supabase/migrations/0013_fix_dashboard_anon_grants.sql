-- Same anon-grant gotcha as 0011, with a twist: revoking EXECUTE FROM anon
-- in the *same script* that CREATEs the function doesn't stick on this
-- project — confirmed via has_function_privilege() showing anon still had
-- access after 0012 ran, despite it containing the correct `revoke ... from
-- anon` statements right after each CREATE. Whatever auto-grants EXECUTE to
-- anon/authenticated on function creation appears to re-apply before that
-- transaction commits. The reliable pattern (matching 0011, which worked) is
-- to revoke in a separate, later migration against the now-already-existing
-- function — never in the same script that creates it.

revoke execute on function public.get_points_history(int) from anon;
revoke execute on function public.get_dashboard_insights() from anon;
revoke execute on function public.chore_period_history(uuid, int) from anon;
revoke execute on function public.chore_period_history(uuid, int) from authenticated;
