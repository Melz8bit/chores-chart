-- Redeems points for a kid: a single guarded UPDATE makes the
-- check-and-decrement atomic (no separate read-then-write race window), then
-- logs the ledger entry. No parent-approval gate beyond the kiosk itself
-- already being a parent-trusted device.
create or replace function public.redeem_points(p_family_member_id uuid, p_amount int)
returns table(points_balance int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance int;
  v_family_id uuid := public.current_family_id();
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  if not exists (
    select 1 from public.family_members
    where id = p_family_member_id and family_id = v_family_id and kind = 'kid'
  ) then
    raise exception 'Member not found or not accessible';
  end if;

  update public.family_members fm
  set points_balance = fm.points_balance - p_amount
  where fm.id = p_family_member_id and fm.points_balance >= p_amount
  returning fm.points_balance into v_new_balance;

  if not found then
    raise exception 'Insufficient points balance';
  end if;

  insert into public.point_transactions (family_id, family_member_id, type, amount)
  values (v_family_id, p_family_member_id, 'redeemed', -p_amount);

  points_balance := v_new_balance;
  return next;
end;
$$;

grant execute on function public.redeem_points(uuid, int) to authenticated;
