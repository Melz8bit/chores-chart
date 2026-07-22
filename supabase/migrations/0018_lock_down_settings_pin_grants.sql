-- Lock down settings_pin so the client can never read the raw value,
-- matching the column-level revoke precedent in
-- 0003_fix_points_balance_grant.sql. A blanket "families: read own" RLS
-- policy already lets any authenticated family member select * their
-- family's row, which would otherwise let a kid on the shared tablet read
-- the PIN directly via the Supabase client and bypass the gate entirely.
-- Separate later migration from 0017, matching the established
-- grant-lockdown pattern (0010->0011, 0015->0016) for this project.
revoke select (settings_pin) on table public.families from authenticated;
revoke select (settings_pin) on table public.families from anon;

revoke execute on function public.has_settings_pin() from public;
revoke execute on function public.has_settings_pin() from anon;
revoke execute on function public.verify_settings_pin(text) from public;
revoke execute on function public.verify_settings_pin(text) from anon;
