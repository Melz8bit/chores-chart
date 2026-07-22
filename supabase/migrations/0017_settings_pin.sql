-- Parent PIN gate for Settings: the kiosk tablet stays logged in as
-- whichever parent last signed in, so any kid with physical access to it
-- currently has full access to Settings. This is a UI-level speedbump, not
-- a new RLS boundary (the session already legitimately belongs to a
-- parent) — the PIN itself must never be readable by the client, though,
-- or a kid could just read it via devtools and bypass the gate entirely.
alter table public.families add column settings_pin text;

-- Lets the UI decide whether to show the gate at all, without exposing
-- the stored value.
create function public.has_settings_pin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select settings_pin is not null from public.families where id = public.current_family_id();
$$;

-- Compares server-side and returns only true/false — the actual PIN value
-- never leaves the database.
create function public.verify_settings_pin(p_pin text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select settings_pin is not null and settings_pin = p_pin
  from public.families where id = public.current_family_id();
$$;

grant execute on function public.has_settings_pin() to authenticated;
grant execute on function public.verify_settings_pin(text) to authenticated;

-- Setting/changing the PIN needs no new RPC: the existing "families:
-- update own" policy already lets a parent update their family row, and
-- writing a value the client already knows leaks nothing.
