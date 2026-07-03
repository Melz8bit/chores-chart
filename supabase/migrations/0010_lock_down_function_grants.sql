-- Security hardening found while building Phase 5: Postgres grants EXECUTE
-- on new functions to PUBLIC by default (unlike tables, which default to
-- owner-only access). Every SECURITY DEFINER function from earlier
-- migrations has therefore been callable by the *anon* role this whole
-- time, not just `authenticated` as intended. Most self-reject anon callers
-- via current_family_id() returning NULL for them, but create_family and
-- join_family don't — they only check "does a family_members row already
-- exist for this auth.uid()", which is false for anon too, letting an
-- unauthenticated caller create a phantom family, or inject a bogus member
-- into a real family via a guessed invite code (auth_user_id would be NULL,
-- so it couldn't be logged into, but it still pollutes the table and the
-- brute-force surface exists regardless of auth).
--
-- Fixed two ways: (1) explicit auth.uid() IS NULL checks in both functions
-- as a second line of defense, (2) revoking the PUBLIC execute grant on
-- every function so only `authenticated` (or nobody, for the internal-only
-- helper) can call them at all going forward.

revoke execute on function public.current_family_id() from public;
revoke execute on function public.create_family(text, text, text) from public;
revoke execute on function public.join_family(text, text) from public;
revoke execute on function public.complete_chore(uuid, uuid) from public;
revoke execute on function public.uncomplete_chore(uuid, uuid) from public;
revoke execute on function public.redeem_points(uuid, int) from public;
revoke execute on function public.get_kiosk_board() from public;

-- chore_period_bounds is an internal helper only ever needed by the
-- functions above, which call it as their SECURITY DEFINER owner
-- (independent of grants to external roles). It also has no family-scoping
-- check of its own, so it shouldn't be directly callable by any client.
revoke execute on function public.chore_period_bounds(uuid, timestamptz) from public;
revoke execute on function public.chore_period_bounds(uuid, timestamptz) from authenticated;

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
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

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
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

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
