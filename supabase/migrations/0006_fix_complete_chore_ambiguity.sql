-- Fixes a bug found during manual testing: complete_chore's RETURNS TABLE
-- declares an out-column named `points_balance`, which PL/pgSQL exposes as a
-- variable throughout the function body. The bare `points_balance` inside
-- `update family_members set points_balance = points_balance + ...` was
-- therefore ambiguous between that variable and the table column. Fixed by
-- aliasing the table and qualifying every reference to it.
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

  update public.family_members fm
  set points_balance = fm.points_balance + v_chore.points
  where fm.id = p_family_member_id
  returning fm.points_balance into v_new_balance;

  insert into public.point_transactions (family_id, family_member_id, type, amount, related_chore_completion_id)
  values (v_chore.family_id, p_family_member_id, 'earned', v_chore.points, v_completion_id);

  points_balance := v_new_balance;
  completed_count := v_count + 1;
  times_per_period := v_chore.times_per_period;
  remaining := v_chore.times_per_period - completed_count;

  return next;
end;
$$;
