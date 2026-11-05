-- Lock down the 0036 functions (separate migration so the anon revokes
-- stick). get_kiosk_board was dropped and recreated, which reset its grants.
revoke execute on function public.get_kiosk_board() from public, anon;
revoke execute on function public.request_chore_approval(uuid, uuid) from public, anon;
revoke execute on function public.decide_chore_approval(uuid, boolean, text, text) from public, anon;
revoke execute on function public.notify_chore_approval_requested() from public, anon, authenticated;
revoke all on table public.chore_approval_requests from anon;
