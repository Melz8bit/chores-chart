-- Optional per-chore school-day points. chores.points stays the full
-- (vacation / weekend / holiday) amount; when school_points is null, school
-- days keep using the automatic rule (points / divisor, rounded up — see
-- family_points_day, 0021). Nullable so every existing chore keeps its
-- current behavior with no backfill.
alter table public.chores
  add column school_points int check (school_points > 0);

-- complete_chore: use school_points on school days when set. Otherwise
-- identical to 0019. Same signatures for both functions below, so CREATE OR
-- REPLACE keeps their existing grants.
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

-- get_kiosk_board: same school_points override. Otherwise identical to 0019.
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
  category_id uuid,
  category_name text,
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
    pb.period_start, pb.period_end
  from public.family_members fm
  join public.chores c on c.assigned_member_id = fm.id and c.active
  left join public.categories cat on cat.id = c.category_id
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
  order by fm.display_name, cat.name nulls last, c.created_at;
end;
$$;
