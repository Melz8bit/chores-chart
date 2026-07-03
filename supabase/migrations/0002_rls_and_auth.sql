-- chores-chart: RLS policies + family bootstrap RPCs
-- Run this after 0001_schema.sql.

-- Looks up the caller's family via their own family_members row.
-- SECURITY DEFINER + pinned search_path avoids the classic Postgres/Supabase
-- footgun of an unpinned search_path on a definer function, and avoids RLS
-- self-recursion when used inside family_members' own policies.
create or replace function public.current_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.family_members where auth_user_id = auth.uid() limit 1;
$$;

grant execute on function public.current_family_id() to authenticated;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.chores enable row level security;
alter table public.chore_completions enable row level security;
alter table public.point_transactions enable row level security;

create policy "families: read own" on public.families
  for select using (id = public.current_family_id());

create policy "families: update own" on public.families
  for update using (id = public.current_family_id()) with check (id = public.current_family_id());

create policy "family_members: read own family" on public.family_members
  for select using (family_id = public.current_family_id());

-- Parents may add kid profiles directly (no RPC needed for this simple case).
-- Parent members themselves may only be created via create_family/join_family,
-- which run as SECURITY DEFINER and so bypass this policy.
create policy "family_members: insert kid only" on public.family_members
  for insert with check (
    family_id = public.current_family_id() and kind = 'kid' and auth_user_id is null
  );

create policy "family_members: update own family" on public.family_members
  for update using (family_id = public.current_family_id())
  with check (family_id = public.current_family_id());

create policy "chores: read own family" on public.chores
  for select using (family_id = public.current_family_id());

create policy "chores: insert own family" on public.chores
  for insert with check (family_id = public.current_family_id());

create policy "chores: update own family" on public.chores
  for update using (family_id = public.current_family_id())
  with check (family_id = public.current_family_id());

create policy "chore_completions: read own family" on public.chore_completions
  for select using (family_id = public.current_family_id());

create policy "point_transactions: read own family" on public.point_transactions
  for select using (family_id = public.current_family_id());

-- Defense in depth: balance-affecting writes only ever happen through
-- SECURITY DEFINER RPCs (added in later migrations), never directly from
-- client code, even if a policy were ever misconfigured.
revoke insert, update, delete on public.chore_completions from authenticated;
revoke insert, update, delete on public.point_transactions from authenticated;
revoke update (points_balance) on public.family_members from authenticated;

create or replace function public.create_family(
  p_family_name text,
  p_timezone text,
  p_parent_display_name text
)
returns public.family_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_code text;
  v_member public.family_members;
begin
  if exists (select 1 from public.family_members where auth_user_id = auth.uid()) then
    raise exception 'You already belong to a family';
  end if;

  loop
    v_code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.families where invite_code = v_code);
  end loop;

  insert into public.families (name, timezone, invite_code)
  values (p_family_name, p_timezone, v_code)
  returning id into v_family_id;

  insert into public.family_members (family_id, auth_user_id, kind, display_name)
  values (v_family_id, auth.uid(), 'parent', p_parent_display_name)
  returning * into v_member;

  return v_member;
end;
$$;

create or replace function public.join_family(
  p_invite_code text,
  p_parent_display_name text
)
returns public.family_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_member public.family_members;
begin
  if exists (select 1 from public.family_members where auth_user_id = auth.uid()) then
    raise exception 'You already belong to a family';
  end if;

  select id into v_family_id from public.families where invite_code = upper(p_invite_code);
  if v_family_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.family_members (family_id, auth_user_id, kind, display_name)
  values (v_family_id, auth.uid(), 'parent', p_parent_display_name)
  returning * into v_member;

  return v_member;
end;
$$;

grant execute on function public.create_family(text, text, text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;
