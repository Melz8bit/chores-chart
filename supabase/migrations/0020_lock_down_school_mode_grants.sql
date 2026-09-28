-- Grant lockdown for the functions created in 0019, in a separate later
-- migration per the established pattern (0010->0011, 0015->0016,
-- 0017->0018): revokes issued in the same migration that creates a function
-- did not stick for anon.
--
-- family_points_day is an internal helper, only called from security
-- definer functions (which run as the owner), so no client role needs it.
revoke execute on function public.family_points_day(uuid, timestamptz) from public;
revoke execute on function public.family_points_day(uuid, timestamptz) from anon;
revoke execute on function public.family_points_day(uuid, timestamptz) from authenticated;

revoke execute on function public.get_points_day() from public;
revoke execute on function public.get_points_day() from anon;
revoke execute on function public.set_holiday(boolean, text) from public;
revoke execute on function public.set_holiday(boolean, text) from anon;
