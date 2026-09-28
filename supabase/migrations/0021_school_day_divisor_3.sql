-- School days earn 1/3 of a chore's points instead of 1/5 (still rounded
-- up) — 1/5 was too steep in practice. Only the divisor changes; otherwise
-- identical to 0019. Same signature, so CREATE OR REPLACE keeps the
-- execute revokes from 0020.
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
    select ((p_at at time zone f.timezone) + interval '4 hours')::date as rate_date
  ) d
  where f.id = p_family_id;
$$;
