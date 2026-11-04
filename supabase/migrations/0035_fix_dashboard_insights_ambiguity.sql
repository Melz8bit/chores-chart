-- Fixes get_dashboard_insights (0012) always failing with "column reference
-- chore_id is ambiguous": its RETURNS TABLE has an OUT column named
-- chore_id, and the completion counts filtered on chore_completions'
-- unqualified chore_id (same bug 0006 fixed in complete_chore). It errored
-- as soon as any chore had a concluded period, and the dashboard showed the
-- failure as "Nothing flagged". Only change: the chore_completions queries
-- are now qualified (cc.). Same signature, so CREATE OR REPLACE keeps the
-- grants from 0012-0014.
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
      from public.chore_completions cc
      where cc.chore_id = v_chore.id and cc.period_start = v_period.period_start;

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
        from public.chore_completions cc
        where cc.chore_id = v_chore.id and cc.period_start = v_period.period_start;

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
