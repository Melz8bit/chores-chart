-- Grant lockdown for get_points_day, recreated in 0023. Separate migration
-- per the established pattern (see 0020): revokes issued in the same
-- migration that creates a function did not stick for anon.
revoke execute on function public.get_points_day() from public;
revoke execute on function public.get_points_day() from anon;
