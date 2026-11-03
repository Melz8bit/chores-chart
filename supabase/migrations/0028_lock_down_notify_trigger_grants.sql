-- Grant lockdown for 0027, in a separate migration per the established
-- pattern (see 0020). notify_chore_completed only ever runs as a trigger;
-- no client role should be able to call it directly.
revoke execute on function public.notify_chore_completed() from public;
revoke execute on function public.notify_chore_completed() from anon;
revoke execute on function public.notify_chore_completed() from authenticated;
