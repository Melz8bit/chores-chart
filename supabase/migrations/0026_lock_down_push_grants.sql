-- Grant lockdown for 0025, in a separate migration per the established
-- pattern (see 0020): revokes issued in the same migration that creates a
-- function did not stick for anon.
revoke execute on function public.register_push_subscription(text, text, text, text) from public;
revoke execute on function public.register_push_subscription(text, text, text, text) from anon;

-- The table's select/delete policies already scope rows to the caller's
-- family; anon has no family, but don't leave it table privileges either.
revoke all on table public.push_subscriptions from anon;
