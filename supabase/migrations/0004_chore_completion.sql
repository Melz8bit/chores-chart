-- chores-chart: chore completion + kiosk board read model
-- Run after 0003_fix_points_balance_grant.sql.

-- Computes the current "period" window for a chore (the day/week/month/cycle
-- that completions get bucketed into for rep-limit purposes), based on the
-- family's timezone and week-start-day. Snapshotted onto chore_completions
-- at insert time so editing a chore's frequency later doesn't rewrite history.
create or replace function public.chore_period_bounds(p_chore_id uuid, p_as_of timestamptz default now())
returns table(period_start timestamptz, period_end timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_chore public.chores%rowtype;
  v_tz text;
  v_week_start_day smallint;
  v_local_date date;
  v_dow int;
  v_offset int;
  v_week_start_date date;
  v_month_start date;
  v_days_since int;
  v_cycle_start date;
begin
  select * into v_chore from public.chores where id = p_chore_id;
  select f.timezone, f.week_start_day into v_tz, v_week_start_day
    from public.families f where f.id = v_chore.family_id;

  v_local_date := (p_as_of at time zone v_tz)::date;

  if v_chore.frequency_type in ('daily', 'weekdays', 'weekends') then
    period_start := v_local_date::timestamp at time zone v_tz;
    period_end := (v_local_date + 1)::timestamp at time zone v_tz;

  elsif v_chore.frequency_type = 'weekly' then
    v_dow := extract(dow from v_local_date)::int;
    v_offset := (v_dow - v_week_start_day + 7) % 7;
    v_week_start_date := v_local_date - v_offset;
    period_start := v_week_start_date::timestamp at time zone v_tz;
    period_end := (v_week_start_date + 7)::timestamp at time zone v_tz;

  elsif v_chore.frequency_type = 'monthly' then
    v_month_start := date_trunc('month', v_local_date::timestamp)::date;
    period_start := v_month_start::timestamp at time zone v_tz;
    period_end := (v_month_start + interval '1 month')::timestamp at time zone v_tz;

  elsif v_chore.frequency_type = 'every_n_days' then
    v_days_since := v_local_date - v_chore.anchor_date;
    v_cycle_start := v_chore.anchor_date
      + (floor(v_days_since::numeric / v_chore.interval_days)::int * v_chore.interval_days);
    period_start := v_cycle_start::timestamp at time zone v_tz;
    period_end := (v_cycle_start + v_chore.interval_days)::timestamp at time zone v_tz;
  end if;

  return next;
end;
$$;

grant execute on function public.chore_period_bounds(uuid, timestamptz) to authenticated;

-- Marks a chore complete for a kid: validates the rep limit for the current
-- period, snapshots points onto the completion row, and atomically bumps the
-- kid's balance + logs the ledger entry. An advisory lock keyed on
-- (chore_id, family_member_id) closes a double-tap race where two rapid taps
-- could both pass the rep-limit check before either commits.
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

  perform pg_advisory_xact_lock(hashtextextended(p_chore_id::text || ':' || p_family_member_id::text, 0));

  select pb.period_start into v_period_start
  from public.chore_period_bounds(p_chore_id, now()) pb;

  select count(*) into v_count
  from public.chore_completions
  where chore_id = p_chore_id and family_member_id = p_family_member_id and period_start = v_period_start;

  if v_count >= v_chore.times_per_period then
    raise exception 'Chore already completed the maximum times for this period';
  end if;

  select id into v_actor_id from public.family_members where auth_user_id = auth.uid();

  insert into public.chore_completions
    (chore_id, family_id, family_member_id, created_by_member_id, points_awarded, period_start)
  values
    (p_chore_id, v_chore.family_id, p_family_member_id, v_actor_id, v_chore.points, v_period_start)
  returning id into v_completion_id;

  update public.family_members
  set points_balance = points_balance + v_chore.points
  where id = p_family_member_id
  returning points_balance into v_new_balance;

  insert into public.point_transactions (family_id, family_member_id, type, amount, related_chore_completion_id)
  values (v_chore.family_id, p_family_member_id, 'earned', v_chore.points, v_completion_id);

  points_balance := v_new_balance;
  completed_count := v_count + 1;
  times_per_period := v_chore.times_per_period;
  remaining := v_chore.times_per_period - completed_count;

  return next;
end;
$$;

grant execute on function public.complete_chore(uuid, uuid) to authenticated;

-- Read model for the kiosk board: one row per (kid, active+eligible chore)
-- with the period/rep-limit math already computed, so the frontend only
-- renders it rather than duplicating this logic in TypeScript.
create or replace function public.get_kiosk_board()
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
  frequency_type text,
  times_per_period int,
  interval_days int,
  completed_count int,
  remaining int,
  period_start timestamptz,
  period_end timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_tz text;
begin
  select timezone into v_tz from public.families where id = v_family_id;

  return query
  select
    fm.id, fm.display_name, fm.emoji, fm.color, fm.points_balance,
    c.id, c.name, c.emoji, c.notes, c.points,
    c.frequency_type, c.times_per_period, c.interval_days,
    coalesce(cc.completed_count, 0)::int,
    greatest(c.times_per_period - coalesce(cc.completed_count, 0), 0)::int,
    pb.period_start, pb.period_end
  from public.family_members fm
  join public.chores c on c.assigned_member_id = fm.id and c.active
  cross join lateral public.chore_period_bounds(c.id, now()) pb
  left join lateral (
    select count(*)::int as completed_count
    from public.chore_completions cc2
    where cc2.chore_id = c.id and cc2.family_member_id = fm.id and cc2.period_start = pb.period_start
  ) cc on true
  where fm.family_id = v_family_id
    and fm.kind = 'kid'
    and fm.archived_at is null
    and (
      c.frequency_type not in ('weekdays', 'weekends')
      or (c.frequency_type = 'weekdays' and extract(dow from (now() at time zone v_tz)) between 1 and 5)
      or (c.frequency_type = 'weekends' and extract(dow from (now() at time zone v_tz)) in (0, 6))
    )
  order by fm.display_name, c.created_at;
end;
$$;

grant execute on function public.get_kiosk_board() to authenticated;
