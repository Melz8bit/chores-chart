-- Phase 6: parent dashboard backend — points history for the chart, and
-- "repeatedly ignored" / "chronically under-completed" chore detection.
-- Learning from the earlier anon-grant gotcha: every function below
-- explicitly revokes from `anon` (not just `public`), and internal helpers
-- are additionally revoked from `authenticated` too.

-- Walks backward through a chore's own period history (day/week/month/cycle,
-- depending on frequency_type), returning up to p_count *already-concluded*
-- eligible periods (most recent first) — skipping ineligible calendar days
-- for weekdays/weekends chores, and stopping once it reaches before the
-- chore's creation date (so a brand-new chore just returns fewer rows,
-- rather than being incorrectly treated as having "ignored" history before
-- it existed).
create or replace function public.chore_period_history(p_chore_id uuid, p_count int)
returns table(period_start timestamptz, period_end timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_chore public.chores%rowtype;
  v_tz text;
  v_as_of timestamptz;
  v_collected int := 0;
  v_ps timestamptz;
  v_pe timestamptz;
  v_local_dow int;
begin
  select * into v_chore from public.chores where id = p_chore_id;
  select timezone into v_tz from public.families where id = v_chore.family_id;

  select pb.period_start into v_as_of from public.chore_period_bounds(p_chore_id, now()) pb;
  v_as_of := v_as_of - interval '1 second';

  while v_collected < p_count and v_as_of >= v_chore.created_at loop
    select pb.period_start, pb.period_end into v_ps, v_pe
    from public.chore_period_bounds(p_chore_id, v_as_of) pb;

    exit when v_ps < v_chore.created_at;

    v_local_dow := extract(dow from (v_ps at time zone v_tz))::int;

    if (v_chore.frequency_type = 'weekdays' and v_local_dow not between 1 and 5)
       or (v_chore.frequency_type = 'weekends' and v_local_dow not in (0, 6)) then
      v_as_of := v_ps - interval '1 second';
      continue;
    end if;

    period_start := v_ps;
    period_end := v_pe;
    return next;

    v_collected := v_collected + 1;
    v_as_of := v_ps - interval '1 second';
  end loop;
end;
$$;

revoke execute on function public.chore_period_history(uuid, int) from anon;
revoke execute on function public.chore_period_history(uuid, int) from authenticated;

create or replace function public.get_dashboard_insights()
returns table(
  chore_id uuid,
  chore_name text,
  chore_emoji text,
  member_id uuid,
  member_name text,
  insight_type text,
  detail text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_chore record;
  v_period record;
  v_zero_streak int;
  v_full_count int;
  v_period_count int;
  v_completed_count int;
begin
  for v_chore in
    select c.id, c.name, c.emoji, c.times_per_period, c.assigned_member_id, fm.display_name as member_name
    from public.chores c
    join public.family_members fm on fm.id = c.assigned_member_id
    where c.family_id = v_family_id and c.active
  loop
    -- "repeatedly ignored": last 3 eligible periods, zero completions in all of them
    v_zero_streak := 0;
    v_period_count := 0;
    for v_period in select * from public.chore_period_history(v_chore.id, 3) loop
      v_period_count := v_period_count + 1;
      select count(*) into v_completed_count
      from public.chore_completions
      where chore_id = v_chore.id and period_start = v_period.period_start;

      if v_completed_count = 0 then
        v_zero_streak := v_zero_streak + 1;
      end if;
    end loop;

    if v_period_count = 3 and v_zero_streak = 3 then
      chore_id := v_chore.id;
      chore_name := v_chore.name;
      chore_emoji := v_chore.emoji;
      member_id := v_chore.assigned_member_id;
      member_name := v_chore.member_name;
      insight_type := 'ignored';
      detail := 'Not done in the last 3 periods';
      return next;
    end if;

    -- "chronically under-completed": multi-rep chores only — full reps
    -- reached in fewer than 3 of the last 7 eligible periods
    if v_chore.times_per_period > 1 then
      v_full_count := 0;
      v_period_count := 0;
      for v_period in select * from public.chore_period_history(v_chore.id, 7) loop
        v_period_count := v_period_count + 1;
        select count(*) into v_completed_count
        from public.chore_completions
        where chore_id = v_chore.id and period_start = v_period.period_start;

        if v_completed_count >= v_chore.times_per_period then
          v_full_count := v_full_count + 1;
        end if;
      end loop;

      if v_period_count = 7 and v_full_count < 3 then
        chore_id := v_chore.id;
        chore_name := v_chore.name;
        chore_emoji := v_chore.emoji;
        member_id := v_chore.assigned_member_id;
        member_name := v_chore.member_name;
        insight_type := 'under_completed';
        detail := format('Fully done %s of the last 7 times', v_full_count);
        return next;
      end if;
    end if;
  end loop;
end;
$$;

grant execute on function public.get_dashboard_insights() to authenticated;
revoke execute on function public.get_dashboard_insights() from anon;

-- Points earned vs. redeemed per family-local day, for the dashboard chart.
create or replace function public.get_points_history(p_days int default 14)
returns table(day date, earned int, redeemed int)
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
    d::date as day,
    coalesce(sum(pt.amount) filter (where pt.type = 'earned'), 0)::int as earned,
    coalesce(sum(-pt.amount) filter (where pt.type = 'redeemed'), 0)::int as redeemed
  from generate_series(
    (now() at time zone v_tz)::date - (p_days - 1),
    (now() at time zone v_tz)::date,
    interval '1 day'
  ) d
  left join public.point_transactions pt
    on pt.family_id = v_family_id
    and (pt.created_at at time zone v_tz)::date = d::date
  group by d
  order by d;
end;
$$;

grant execute on function public.get_points_history(int) to authenticated;
revoke execute on function public.get_points_history(int) from anon;
