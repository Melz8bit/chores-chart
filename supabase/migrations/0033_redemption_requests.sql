-- Phase 4 of parent notifications: redeeming points becomes a request that
-- a parent approves or denies. Points only leave the kid's balance on
-- approval; while pending they're held (they count against what the kid can
-- request next), so the same points can't be asked for twice.
create table public.redemption_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  amount int not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_member_id uuid references public.family_members(id) on delete set null,
  -- The 'redeemed' ledger row written on approval.
  point_transaction_id uuid references public.point_transactions(id) on delete set null
);

create index redemption_requests_family_status_idx on public.redemption_requests (family_id, status);

alter table public.redemption_requests enable row level security;

-- Read-only for clients; every change goes through the RPCs below.
create policy "redemption_requests: read own family" on public.redemption_requests
  for select using (family_id = public.current_family_id());

revoke insert, update, delete on public.redemption_requests from authenticated;

-- One-tap approval from a parent's phone: when a device registers for
-- notifications it also generates a random approval key, kept only on that
-- device (localStorage). The database stores just its SHA-256 hash. The
-- kiosk tablet never registers, so it never has a key and must use the PIN.
alter table public.push_subscriptions add column approval_key_hash text;

-- register_push_subscription gains p_approval_key; dropped and recreated
-- because the signature changes. Grants are re-locked in 0034.
drop function public.register_push_subscription(text, text, text, text);

create function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_device_label text,
  p_approval_key text
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
  if length(p_approval_key) < 32 then
    raise exception 'Approval key is too short';
  end if;

  insert into public.push_subscriptions
    (family_id, family_member_id, endpoint, p256dh, auth, device_label, approval_key_hash)
  values
    (v_member.family_id, v_member.id, p_endpoint, p_p256dh, p_auth, left(p_device_label, 80),
     encode(sha256(convert_to(p_approval_key, 'UTF8')), 'hex'))
  on conflict (endpoint) do update
    set family_id = excluded.family_id,
        family_member_id = excluded.family_member_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        device_label = excluded.device_label,
        approval_key_hash = excluded.approval_key_hash;
end;
$$;

grant execute on function public.register_push_subscription(text, text, text, text, text) to authenticated;

-- Kiosk: ask to spend points. Fails if the kid's balance minus what's
-- already pending doesn't cover it. Returns the new request id.
create function public.request_redemption(p_family_member_id uuid, p_amount int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_balance int;
  v_pending int;
  v_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  -- Serialize requests per kid so two quick taps can't both pass the check.
  perform pg_advisory_xact_lock(hashtextextended('redeem:' || p_family_member_id::text, 0));

  select points_balance into v_balance from public.family_members
  where id = p_family_member_id and family_id = v_family_id and kind = 'kid' and archived_at is null;
  if not found then
    raise exception 'Member not found or not accessible';
  end if;

  select coalesce(sum(amount), 0) into v_pending from public.redemption_requests
  where family_member_id = p_family_member_id and status = 'pending';

  if v_balance - v_pending < p_amount then
    raise exception 'Insufficient points balance';
  end if;

  insert into public.redemption_requests (family_id, family_member_id, amount)
  values (v_family_id, p_family_member_id, p_amount)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.request_redemption(uuid, int) to authenticated;

-- Approve or deny a pending request. Allowed with either the family's
-- Settings PIN (kiosk tablet; no PIN set = no check, like set_holiday) or
-- the approval key of one of the family's registered devices (parent phone).
create function public.decide_redemption(
  p_request_id uuid,
  p_approve boolean,
  p_pin text,
  p_device_key text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_request public.redemption_requests%rowtype;
  v_pin text;
  v_device_ok boolean;
  v_actor_id uuid;
  v_kid_name text;
  v_balance int;
  v_tx_id uuid;
begin
  select * into v_request from public.redemption_requests
  where id = p_request_id and family_id = v_family_id
  for update;
  if not found then
    raise exception 'Request not found or not accessible';
  end if;

  select settings_pin into v_pin from public.families where id = v_family_id;
  v_device_ok := p_device_key is not null and exists (
    select 1 from public.push_subscriptions
    where family_id = v_family_id
      and approval_key_hash = encode(sha256(convert_to(p_device_key, 'UTF8')), 'hex')
  );
  if not v_device_ok and v_pin is not null and v_pin is distinct from p_pin then
    raise exception 'Incorrect PIN';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This request was already %', v_request.status;
  end if;

  select id into v_actor_id from public.family_members where auth_user_id = auth.uid();

  if p_approve then
    update public.family_members fm
    set points_balance = fm.points_balance - v_request.amount
    where fm.id = v_request.family_member_id and fm.points_balance >= v_request.amount;

    if not found then
      select display_name, points_balance into v_kid_name, v_balance
      from public.family_members where id = v_request.family_member_id;
      raise exception '% only has % points now (unused points expire overnight). Deny this request instead.',
        v_kid_name, v_balance;
    end if;

    insert into public.point_transactions (family_id, family_member_id, type, amount)
    values (v_family_id, v_request.family_member_id, 'redeemed', -v_request.amount)
    returning id into v_tx_id;
  end if;

  update public.redemption_requests
  set status = case when p_approve then 'approved' else 'denied' end,
      decided_at = now(),
      decided_by_member_id = v_actor_id,
      point_transaction_id = v_tx_id
  where id = p_request_id;

  return case when p_approve then 'approved' else 'denied' end;
end;
$$;

grant execute on function public.decide_redemption(uuid, boolean, text, text) to authenticated;

-- Push every new request to the family's registered parent devices, via
-- send-push (same pg_net + Vault setup as 0027). Only the id is sent.
create function public.notify_redemption_requested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object('type', 'redemption_requested', 'request_id', new.id)
  );
  return new;
exception when others then
  raise warning 'notify_redemption_requested failed: %', sqlerrm;
  return new;
end;
$$;

create trigger redemption_requests_notify
  after insert on public.redemption_requests
  for each row execute function public.notify_redemption_requested();
