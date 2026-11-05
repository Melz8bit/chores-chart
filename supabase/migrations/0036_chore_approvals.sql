-- Chores that need a parent's OK before they count (mostly bonus chores, so
-- a kid can't tap them for free points). When a chore has requires_approval,
-- tapping it on the kiosk creates a pending chore_approval_requests row
-- instead of a completion. A parent approves or denies it like a redemption
-- request (0033): Settings PIN on the tablet, or one tap on a registered
-- phone. Only approval writes the completion and awards the points.
alter table public.chores
  add column requires_approval boolean not null default false;

create table public.chore_approval_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  chore_id uuid not null references public.chores(id) on delete cascade,
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  -- The chore period the kid did it in, and the points it was worth then
  -- (school-day rate etc.). Approving later still credits that period.
  period_start timestamptz not null,
  points int not null check (points > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_member_id uuid references public.family_members(id) on delete set null,
  -- The completion written on approval.
  chore_completion_id uuid references public.chore_completions(id) on delete set null
);

create index chore_approval_requests_family_status_idx on public.chore_approval_requests (family_id, status);

alter table public.chore_approval_requests enable row level security;

-- Read-only for clients; every change goes through the RPCs below.
create policy "chore_approval_requests: read own family" on public.chore_approval_requests
  for select using (family_id = public.current_family_id());

revoke insert, update, delete on public.chore_approval_requests from authenticated;

-- complete_chore: refuse chores that need approval, so the client can't skip
-- the request. Otherwise identical to 0022. Same signature, so CREATE OR
-- REPLACE keeps its grants.
create or replace function public.complete_chore(p_chore_id uuid, p_family_member_id uuid)
returns table(points_balance int, completed_count int, times_per_period int, remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chore public.chores%rowtype;
  v_period_start timestamptz;
  v_count int;
  v_completion_id uuid;
  v_actor_id uuid;
  v_new_balance int;
  v_points int;
begin
  select * into v_chore from public.chores where id = p_chore_id and family_id = public.current_family_id();
  if not found then
    raise exception 'Chore not found or not accessible';
  end if;
  if v_chore.assigned_member_id <> p_family_member_id then
    raise exception 'Chore is not assigned to this member';
  end if;
  if not v_chore.active then
    raise exception 'Chore is archived';
  end if;
  if v_chore.requires_approval then
    raise exception 'This chore needs a parent''s approval';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_chore_id::text || ':' || p_family_member_id::text, 0));

  select pb.period_start into v_period_start
  from public.chore_period_bounds(p_chore_id, now()) pb;

  select count(*) into v_count
  from public.chore_completions
  where chore_id = p_chore_id and family_member_id = p_family_member_id and period_start = v_period_start;

  if v_count >= v_chore.times_per_period then
    raise exception 'Chore already completed the maximum times for this period';
  end if;

  select case
    when pd.divisor = 1 then v_chore.points
    else coalesce(v_chore.school_points, ceil(v_chore.points::numeric / pd.divisor)::int)
  end into v_points
  from public.family_points_day(v_chore.family_id, now()) pd;

  select id into v_actor_id from public.family_members where auth_user_id = auth.uid();

  insert into public.chore_completions
    (chore_id, family_id, family_member_id, created_by_member_id, points_awarded, period_start)
  values
    (p_chore_id, v_chore.family_id, p_family_member_id, v_actor_id, v_points, v_period_start)
  returning id into v_completion_id;

  update public.family_members fm
  set points_balance = fm.points_balance + v_points
  where fm.id = p_family_member_id
  returning fm.points_balance into v_new_balance;

  insert into public.point_transactions (family_id, family_member_id, type, amount, related_chore_completion_id)
  values (v_chore.family_id, p_family_member_id, 'earned', v_points, v_completion_id);

  points_balance := v_new_balance;
  completed_count := v_count + 1;
  times_per_period := v_chore.times_per_period;
  remaining := v_chore.times_per_period - completed_count;

  return next;
end;
$$;

-- Kiosk: a kid says they did a chore that needs approval. Pending requests
-- count against the period's limit, so it can't be asked for twice. Returns
-- the new request id.
create function public.request_chore_approval(p_chore_id uuid, p_family_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chore public.chores%rowtype;
  v_period_start timestamptz;
  v_count int;
  v_points int;
  v_id uuid;
begin
  select * into v_chore from public.chores where id = p_chore_id and family_id = public.current_family_id();
  if not found then
    raise exception 'Chore not found or not accessible';
  end if;
  if v_chore.assigned_member_id <> p_family_member_id then
    raise exception 'Chore is not assigned to this member';
  end if;
  if not v_chore.active then
    raise exception 'Chore is archived';
  end if;
  if not v_chore.requires_approval then
    raise exception 'This chore doesn''t need approval';
  end if;

  -- Same lock as complete_chore / uncomplete_chore.
  perform pg_advisory_xact_lock(hashtextextended(p_chore_id::text || ':' || p_family_member_id::text, 0));

  select pb.period_start into v_period_start
  from public.chore_period_bounds(p_chore_id, now()) pb;

  select
    (select count(*) from public.chore_completions cc
     where cc.chore_id = p_chore_id and cc.family_member_id = p_family_member_id
       and cc.period_start = v_period_start)
    + (select count(*) from public.chore_approval_requests r
       where r.chore_id = p_chore_id and r.family_member_id = p_family_member_id
         and r.period_start = v_period_start and r.status = 'pending')
  into v_count;

  if v_count >= v_chore.times_per_period then
    raise exception 'Chore already completed the maximum times for this period';
  end if;

  select case
    when pd.divisor = 1 then v_chore.points
    else coalesce(v_chore.school_points, ceil(v_chore.points::numeric / pd.divisor)::int)
  end into v_points
  from public.family_points_day(v_chore.family_id, now()) pd;

  insert into public.chore_approval_requests (family_id, chore_id, family_member_id, period_start, points)
  values (v_chore.family_id, p_chore_id, p_family_member_id, v_period_start, v_points)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.request_chore_approval(uuid, uuid) to authenticated;

-- Approve or deny a pending request. Same check as decide_redemption: the
-- family's Settings PIN (no PIN set = no check) or the approval key of one of
-- the family's registered devices. Approving writes the completion for the
-- period it was requested in, with the points it was worth then.
create function public.decide_chore_approval(
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
  v_request public.chore_approval_requests%rowtype;
  v_pin text;
  v_device_ok boolean;
  v_actor_id uuid;
  v_times int;
  v_count int;
  v_completion_id uuid;
begin
  select * into v_request from public.chore_approval_requests
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
    perform pg_advisory_xact_lock(
      hashtextextended(v_request.chore_id::text || ':' || v_request.family_member_id::text, 0));

    -- Guards against the chore having been completed directly in the
    -- meantime (e.g. approval was switched off while this was pending).
    select c.times_per_period into v_times from public.chores c where c.id = v_request.chore_id;
    select count(*) into v_count from public.chore_completions cc
    where cc.chore_id = v_request.chore_id and cc.family_member_id = v_request.family_member_id
      and cc.period_start = v_request.period_start;
    if v_count >= v_times then
      raise exception 'That chore was already completed for this period. Deny this request instead.';
    end if;

    insert into public.chore_completions
      (chore_id, family_id, family_member_id, created_by_member_id, points_awarded, period_start)
    values
      (v_request.chore_id, v_family_id, v_request.family_member_id, v_actor_id, v_request.points,
       v_request.period_start)
    returning id into v_completion_id;

    update public.family_members fm
    set points_balance = fm.points_balance + v_request.points
    where fm.id = v_request.family_member_id;

    insert into public.point_transactions (family_id, family_member_id, type, amount, related_chore_completion_id)
    values (v_family_id, v_request.family_member_id, 'earned', v_request.points, v_completion_id);
  end if;

  update public.chore_approval_requests
  set status = case when p_approve then 'approved' else 'denied' end,
      decided_at = now(),
      decided_by_member_id = v_actor_id,
      chore_completion_id = v_completion_id
  where id = p_request_id;

  return case when p_approve then 'approved' else 'denied' end;
end;
$$;

grant execute on function public.decide_chore_approval(uuid, boolean, text, text) to authenticated;

-- Push every new request to the family's registered parent devices, via
-- send-push (same pg_net + Vault setup as 0027). Only the id is sent.
create function public.notify_chore_approval_requested()
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
    body := jsonb_build_object('type', 'chore_approval_requested', 'request_id', new.id)
  );
  return new;
exception when others then
  raise warning 'notify_chore_approval_requested failed: %', sqlerrm;
  return new;
end;
$$;

create trigger chore_approval_requests_notify
  after insert on public.chore_approval_requests
  for each row execute function public.notify_chore_approval_requested();

-- get_kiosk_board gains requires_approval and pending_count (requests waiting
-- for a parent in the current period). The return columns change, so it's
-- dropped and recreated; grants are re-locked in 0037. Otherwise identical
-- to 0022.
drop function public.get_kiosk_board();

create function public.get_kiosk_board()
returns table (
  member_id uuid,
  member_name text,
  member_emoji text,
  member_color text,
  points_balance int,
  chore_id uuid,
  chore_name text,
  chore_emoji text,
  chore_notes text,
  chore_points int,
  category_id uuid,
  category_name text,
  frequency_type text,
  times_per_period int,
  interval_days int,
  completed_count int,
  remaining int,
  period_start timestamptz,
  period_end timestamptz,
  requires_approval boolean,
  pending_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_tz text;
  v_divisor int;
begin
  select timezone into v_tz from public.families where id = v_family_id;
  select pd.divisor into v_divisor from public.family_points_day(v_family_id, now()) pd;

  return query
  select
    fm.id, fm.display_name, fm.emoji, fm.color, fm.points_balance,
    c.id, c.name, c.emoji, c.notes,
    case
      when v_divisor = 1 then c.points
      else coalesce(c.school_points, ceil(c.points::numeric / v_divisor)::int)
    end,
    cat.id, cat.name,
    c.frequency_type, c.times_per_period::int, c.interval_days::int,
    coalesce(cc.completed_count, 0)::int,
    greatest(c.times_per_period::int - coalesce(cc.completed_count, 0), 0)::int,
    pb.period_start, pb.period_end,
    c.requires_approval,
    coalesce(pr.pending_count, 0)::int
  from public.family_members fm
  join public.chores c on c.assigned_member_id = fm.id and c.active
  left join public.categories cat on cat.id = c.category_id
  cross join lateral public.chore_period_bounds(c.id, now()) pb
  left join lateral (
    select count(*)::int as completed_count
    from public.chore_completions cc2
    where cc2.chore_id = c.id and cc2.family_member_id = fm.id and cc2.period_start = pb.period_start
  ) cc on true
  left join lateral (
    select count(*)::int as pending_count
    from public.chore_approval_requests r
    where r.chore_id = c.id and r.family_member_id = fm.id and r.period_start = pb.period_start
      and r.status = 'pending'
  ) pr on true
  where fm.family_id = v_family_id
    and fm.kind = 'kid'
    and fm.archived_at is null
    and (
      c.frequency_type not in ('weekdays', 'weekends')
      or (c.frequency_type = 'weekdays' and extract(dow from (now() at time zone v_tz)) between 1 and 5)
      or (c.frequency_type = 'weekends' and extract(dow from (now() at time zone v_tz)) in (0, 6))
    )
  order by fm.display_name, cat.name nulls last, c.created_at;
end;
$$;

grant execute on function public.get_kiosk_board() to authenticated;
