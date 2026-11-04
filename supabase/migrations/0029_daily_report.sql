-- Phase 3 of parent notifications: a once-a-day summary of each kid's day,
-- pushed at one family-wide time to the registered devices (0025) of the
-- parents who opted in. Uses the same pg_net -> send-push path and Vault
-- secrets as 0027.

-- Local hour the report goes out (12 = noon ... 23 = 11pm). Afternoon and
-- evening only, so "today" in the report is always the day being summarized.
alter table public.families
  add column daily_report_hour smallint not null default 20
    check (daily_report_hour between 12 and 23),
  -- Same once-per-local-day guard as last_expired_date (0009).
  add column last_daily_report_date date;

-- Per-parent opt-in. Off by default; it only affects that parent's own
-- registered devices.
alter table public.family_members
  add column daily_report boolean not null default false;

-- One row per active kid: today's chores (those whose period closes at
-- local midnight tonight, so daily chores every day, weekly/monthly/every-N-
-- days chores on their last day), how many are done, which aren't, and
-- today's points earned/redeemed. Called only by send-push with the service
-- role; grants are locked down in 0030.
create function public.get_daily_report(p_family_id uuid)
returns table (
  kid_name text,
  chores_due int,
  chores_done int,
  still_to_do text[],
  points_earned int,
  points_redeemed int
)
language sql
stable
security definer
set search_path = public
as $$
  with fam as (
    select f.timezone as tz, (now() at time zone f.timezone)::date as today
    from public.families f
    where f.id = p_family_id
  ),
  due_chores as (
    select
      c.assigned_member_id as kid_id,
      concat_ws(' ', c.emoji, c.name) as label,
      (
        select count(*)
        from public.chore_completions cc
        where cc.chore_id = c.id
          and cc.family_member_id = c.assigned_member_id
          and cc.period_start = pb.period_start
      ) >= c.times_per_period as is_done
    from public.chores c
    cross join fam
    cross join lateral public.chore_period_bounds(c.id, now()) pb
    where c.family_id = p_family_id
      and c.active
      and pb.period_end = (fam.today + 1)::timestamp at time zone fam.tz
      and (
        c.frequency_type not in ('weekdays', 'weekends')
        or (c.frequency_type = 'weekdays' and extract(dow from fam.today) between 1 and 5)
        or (c.frequency_type = 'weekends' and extract(dow from fam.today) in (0, 6))
      )
  ),
  kid_points as (
    select
      pt.family_member_id as kid_id,
      coalesce(sum(pt.amount) filter (where pt.type = 'earned'), 0)::int as earned,
      coalesce(-sum(pt.amount) filter (where pt.type = 'redeemed'), 0)::int as redeemed
    from public.point_transactions pt
    cross join fam
    where pt.family_id = p_family_id
      and pt.created_at >= fam.today::timestamp at time zone fam.tz
    group by pt.family_member_id
  )
  select
    fm.display_name,
    count(d.kid_id)::int,
    (count(d.kid_id) filter (where d.is_done))::int,
    coalesce(array_agg(d.label order by d.label) filter (where not d.is_done), '{}'),
    coalesce(kp.earned, 0),
    coalesce(kp.redeemed, 0)
  from public.family_members fm
  left join due_chores d on d.kid_id = fm.id
  left join kid_points kp on kp.kid_id = fm.id
  where fm.family_id = p_family_id and fm.kind = 'kid' and fm.archived_at is null
  group by fm.id, fm.display_name, kp.earned, kp.redeemed
  order by fm.display_name;
$$;

-- Sweep run by pg_cron every 15 minutes (each family has its own timezone,
-- like expire_unused_points). Once a family's local time passes its report
-- hour, it's marked done for today and, if any opted-in parent has a
-- registered device, send-push is asked to build and deliver the report.
create function public.send_daily_reports()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_family record;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return; -- notifications not configured
  end if;

  for v_family in
    select f.id, (now() at time zone f.timezone)::date as local_today
    from public.families f
    where extract(hour from (now() at time zone f.timezone)) >= f.daily_report_hour
      and f.last_daily_report_date is distinct from (now() at time zone f.timezone)::date
  loop
    update public.families set last_daily_report_date = v_family.local_today where id = v_family.id;

    if exists (
      select 1
      from public.push_subscriptions ps
      join public.family_members fm on fm.id = ps.family_member_id
      where ps.family_id = v_family.id and fm.daily_report
    ) then
      perform net.http_post(
        url := v_url || '/functions/v1/send-push',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
        body := jsonb_build_object('type', 'daily_report', 'family_id', v_family.id)
      );
    end if;
  end loop;
end;
$$;

select cron.schedule(
  'send-daily-reports',
  '*/15 * * * *',
  $$select public.send_daily_reports();$$
);
