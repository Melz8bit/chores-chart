-- Root cause of 0010 not actually working: this Supabase project auto-grants
-- EXECUTE on new functions directly to the `anon` role (and `authenticated`),
-- not via the PUBLIC pseudo-role — confirmed via has_function_privilege().
-- `revoke ... from public` therefore never touched anon's real grant.
-- Verified via testing that every one of these was still safely rejected in
-- practice (they all gate on current_family_id(), which is NULL for anon),
-- so this was a defense-in-depth gap, not an active exploit — closing it
-- properly now by revoking from `anon` explicitly everywhere.

revoke execute on function public.current_family_id() from anon;
revoke execute on function public.create_family(text, text, text) from anon;
revoke execute on function public.join_family(text, text) from anon;
revoke execute on function public.complete_chore(uuid, uuid) from anon;
revoke execute on function public.uncomplete_chore(uuid, uuid) from anon;
revoke execute on function public.redeem_points(uuid, int) from anon;
revoke execute on function public.get_kiosk_board() from anon;

-- Internal-only helper: nobody external, authenticated or not, should call
-- this directly.
revoke execute on function public.chore_period_bounds(uuid, timestamptz) from anon;

-- System/cron-only: not even a logged-in parent should trigger this on
-- demand from the app.
revoke execute on function public.expire_unused_points() from anon;
revoke execute on function public.expire_unused_points() from authenticated;
