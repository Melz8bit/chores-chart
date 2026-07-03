-- Nightly points expiry: a kid's unused balance is wiped at local midnight,
-- except points earned 8:00 PM-midnight get one extra day of grace (capped
-- at whatever's still unspent) before also expiring. Runs on a frequent
-- sweep (every 15 min, see cron.schedule below) rather than a single
-- fixed-UTC cron, because each family can have its own timezone; each
-- family is only actually processed once per its own local day, guarded by
-- families.last_expired_date.
create or replace function public.expire_unused_points()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family record;
  v_local_today date;
  v_boundary timestamptz;         -- this family's local midnight, "today"
  v_late_window_start timestamptz; -- yesterday 20:00 local
  v_late_window_end timestamptz;   -- = v_boundary
  v_member record;
  v_post_boundary_delta int;
  v_late_sum int;
  v_balance_at_boundary int;
  v_new_balance int;
  v_wiped int;
begin
  for v_family in select id, timezone, last_expired_date from public.families loop
    v_local_today := (now() at time zone v_family.timezone)::date;

    -- already processed today for this family
    if v_family.last_expired_date is not distinct from v_local_today then
      continue;
    end if;

    v_boundary := v_local_today::timestamp at time zone v_family.timezone;
    v_late_window_start := (v_local_today - 1)::timestamp at time zone v_family.timezone + interval '20 hours';
    v_late_window_end := v_boundary;

    for v_member in
      select id, points_balance from public.family_members
      where family_id = v_family.id and kind = 'kid' and archived_at is null
    loop
      -- Anything that happened after the real midnight boundary, regardless
      -- of how late this sweep actually runs, gets added back untouched
      -- rather than accidentally clamped away with yesterday's leftovers.
      select coalesce(sum(amount), 0) into v_post_boundary_delta
      from public.point_transactions
      where family_member_id = v_member.id and created_at >= v_boundary;

      select coalesce(sum(amount), 0) into v_late_sum
      from public.point_transactions
      where family_member_id = v_member.id
        and type = 'earned'
        and created_at >= v_late_window_start
        and created_at < v_late_window_end;

      v_balance_at_boundary := v_member.points_balance - v_post_boundary_delta;
      v_new_balance := least(v_balance_at_boundary, v_late_sum) + v_post_boundary_delta;
      v_wiped := v_balance_at_boundary - least(v_balance_at_boundary, v_late_sum);

      if v_wiped > 0 then
        update public.family_members fm
        set points_balance = v_new_balance
        where fm.id = v_member.id;

        insert into public.point_transactions (family_id, family_member_id, type, amount, note)
        values (v_family.id, v_member.id, 'expired', -v_wiped, 'Nightly expiry');
      end if;
    end loop;

    update public.families set last_expired_date = v_local_today where id = v_family.id;
  end loop;
end;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default (unlike
-- tables) — explicitly lock this one down since it's a system/maintenance
-- job that processes every family unconditionally, not something any
-- logged-in (or anonymous) client should be able to trigger on demand.
revoke execute on function public.expire_unused_points() from public;

create extension if not exists pg_cron;

select cron.schedule(
  'expire-unused-points',
  '*/15 * * * *',
  $$select public.expire_unused_points();$$
);
