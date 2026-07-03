-- Lets a parent undo an accidental tap: removes the most recent completion
-- of a chore for a kid within the current period and refunds the points.
-- Guarded so it can't drive a balance negative — if those points were
-- already redeemed, the undo is rejected rather than silently allowed.
create or replace function public.uncomplete_chore(p_chore_id uuid, p_family_member_id uuid)
returns table(points_balance int, completed_count int, times_per_period int, remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chore public.chores%rowtype;
  v_period_start timestamptz;
  v_last_completion public.chore_completions%rowtype;
  v_count int;
  v_new_balance int;
begin
  select * into v_chore from public.chores where id = p_chore_id and family_id = public.current_family_id();
  if not found then
    raise exception 'Chore not found or not accessible';
  end if;
  if v_chore.assigned_member_id <> p_family_member_id then
    raise exception 'Chore is not assigned to this member';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_chore_id::text || ':' || p_family_member_id::text, 0));

  select pb.period_start into v_period_start
  from public.chore_period_bounds(p_chore_id, now()) pb;

  select * into v_last_completion
  from public.chore_completions
  where chore_id = p_chore_id and family_member_id = p_family_member_id and period_start = v_period_start
  order by completed_at desc
  limit 1;

  if not found then
    raise exception 'Nothing to undo for this period';
  end if;

  update public.family_members fm
  set points_balance = fm.points_balance - v_last_completion.points_awarded
  where fm.id = p_family_member_id and fm.points_balance >= v_last_completion.points_awarded
  returning fm.points_balance into v_new_balance;

  if not found then
    raise exception 'Cannot undo — those points have already been redeemed';
  end if;

  delete from public.point_transactions where related_chore_completion_id = v_last_completion.id;
  delete from public.chore_completions where id = v_last_completion.id;

  select count(*) into v_count
  from public.chore_completions
  where chore_id = p_chore_id and family_member_id = p_family_member_id and period_start = v_period_start;

  points_balance := v_new_balance;
  completed_count := v_count;
  times_per_period := v_chore.times_per_period;
  remaining := v_chore.times_per_period - v_count;

  return next;
end;
$$;

grant execute on function public.uncomplete_chore(uuid, uuid) to authenticated;
