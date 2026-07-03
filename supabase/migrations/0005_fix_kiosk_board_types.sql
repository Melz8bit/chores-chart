-- Fixes a type mismatch found during manual testing: chores.times_per_period
-- and chores.interval_days are `smallint` in the schema, but
-- get_kiosk_board's RETURNS TABLE declares them as `int` — Postgres requires
-- an exact type match for `return query`, it won't implicitly widen
-- smallint -> integer here. Cast explicitly in the select list instead of
-- weakening the declared return type (int is the more useful type for
-- callers to work with).
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
    c.frequency_type, c.times_per_period::int, c.interval_days::int,
    coalesce(cc.completed_count, 0)::int,
    greatest(c.times_per_period::int - coalesce(cc.completed_count, 0), 0)::int,
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
