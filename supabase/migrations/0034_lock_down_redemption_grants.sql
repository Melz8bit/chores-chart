-- Lock down the 0033 functions (separate migration so the anon revokes
-- stick). The kiosk RPCs are for signed-in parents only; the trigger
-- function is never called directly.
revoke execute on function public.register_push_subscription(text, text, text, text, text) from public, anon;
revoke execute on function public.request_redemption(uuid, int) from public, anon;
revoke execute on function public.decide_redemption(uuid, boolean, text, text) from public, anon;
revoke execute on function public.notify_redemption_requested() from public, anon, authenticated;
revoke all on table public.redemption_requests from anon;

-- The old instant redeem (0008) would skip approval entirely; the kiosk now
-- uses request_redemption, so nothing on the client may call it anymore.
revoke execute on function public.redeem_points(uuid, int) from public, anon, authenticated;
