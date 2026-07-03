-- Fixes a gap found during manual testing: REVOKE UPDATE (points_balance) in
-- 0002 had no effect, because Supabase's default table-wide
-- `GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated` already covers
-- every column, and a column-specific REVOKE doesn't override a table-wide
-- GRANT (Postgres tracks them as separate ACL layers — a role that holds a
-- privilege at both the table level and the column level keeps it if you only
-- revoke one of the two). The fix is to revoke UPDATE at the table level
-- entirely, then re-grant it only on the columns that are safe for parents to
-- edit directly (profile fields), leaving points_balance, kind, family_id,
-- and auth_user_id reachable only through the SECURITY DEFINER RPCs.

revoke update on public.family_members from authenticated;

grant update (display_name, emoji, color, archived_at)
  on public.family_members to authenticated;

-- Clean up the direct-write bypass exercised during testing.
update public.family_members set points_balance = 0 where points_balance = 9999;
