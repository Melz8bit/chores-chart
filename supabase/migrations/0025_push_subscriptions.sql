-- Web Push: one row per device (browser) a parent has opted in to receive
-- notifications on. Notifications target these devices, not accounts — the
-- kiosk tablet is logged in as a parent too, and it must never receive
-- approval requests, so it simply never registers.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  -- The parent who turned notifications on for this device.
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  -- PushSubscription fields from the browser. endpoint is unique per
  -- browser install, so re-registering the same device updates its row.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- e.g. "Pixel 8 · Chrome", shown in the device list so parents can tell
  -- devices apart and spot (and remove) one that shouldn't be there.
  device_label text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_family_id_idx on public.push_subscriptions (family_id);

alter table public.push_subscriptions enable row level security;

-- Parents see every registered device in the family (both parents' phones),
-- and either parent can remove one. Inserts/updates only go through
-- register_push_subscription below, so there's no insert/update policy.
create policy "push_subscriptions: read own family" on public.push_subscriptions
  for select using (family_id = public.current_family_id());

create policy "push_subscriptions: delete own family" on public.push_subscriptions
  for delete using (family_id = public.current_family_id());

-- Registers (or re-registers) the caller's current device. An upsert on
-- endpoint: the same browser re-subscribing, or a different parent logging
-- in on it, takes the row over instead of failing on the unique endpoint.
create function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_device_label text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.family_members%rowtype;
begin
  select * into v_member from public.family_members
  where auth_user_id = auth.uid() and kind = 'parent';
  if not found then
    raise exception 'Only a parent account can register a device for notifications';
  end if;

  insert into public.push_subscriptions (family_id, family_member_id, endpoint, p256dh, auth, device_label)
  values (v_member.family_id, v_member.id, p_endpoint, p_p256dh, p_auth, left(p_device_label, 80))
  on conflict (endpoint) do update
    set family_id = excluded.family_id,
        family_member_id = excluded.family_member_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        device_label = excluded.device_label;
end;
$$;

grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
