-- Makes the points-day rollover configurable per family instead of a fixed
-- 8:00 PM. rollover_hour is the local hour the next points day starts:
-- 20 = 8pm the night before (the 0019 behavior, so the default changes
-- nothing), 0 = midnight (no shift). Limited to noon through midnight —
-- the rollover is meant as an "evening counts as tomorrow" shift.
alter table public.families
  add column rollover_hour smallint not null default 20
    check (rollover_hour = 0 or rollover_hour between 12 and 23);

-- Same as 0021 except the fixed '4 hours' shift becomes (24 - rollover_hour)
-- hours. Same signature, so CREATE OR REPLACE keeps the execute revokes
-- from 0020.
create or replace function public.family_points_day(p_family_id uuid, p_at timestamptz)
returns table (points_mode text, rate_date date, day_kind text, divisor int)
language sql
stable
set search_path = public
as $$
  select
    f.points_mode,
    d.rate_date,
    case
      when f.points_mode = 'vacation' then 'vacation'
      when f.holiday_date = d.rate_date then 'holiday'
      when extract(isodow from d.rate_date) in (6, 7) then 'weekend'
      else 'school_day'
    end,
    case
      when f.points_mode = 'school'
        and f.holiday_date is distinct from d.rate_date
        and extract(isodow from d.rate_date) between 1 and 5
      then 3
      else 1
    end
  from public.families f
  cross join lateral (
    select ((p_at at time zone f.timezone)
      + make_interval(hours => (24 - f.rollover_hour) % 24))::date as rate_date
  ) d
  where f.id = p_family_id;
$$;

-- get_points_day also returns rollover_hour so the kiosk can say when a
-- holiday ends. New OUT column, so it has to be dropped and recreated;
-- grants are re-locked in 0024.
drop function public.get_points_day();

create function public.get_points_day()
returns table (points_mode text, day_kind text, rollover_hour int)
language sql
stable
security definer
set search_path = public
as $$
  select pd.points_mode, pd.day_kind, f.rollover_hour::int
  from public.families f
  cross join lateral public.family_points_day(f.id, now()) pd
  where f.id = public.current_family_id();
$$;

grant execute on function public.get_points_day() to authenticated;
