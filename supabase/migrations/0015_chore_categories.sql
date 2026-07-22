-- Chore categories: family-scoped grouping for chores (e.g. "Kitchen",
-- "Outdoor", "Bedroom"). Table-backed rather than a plain text column so
-- categories can be renamed/archived independently of the chores that
-- reference them. Name-only, no icon/emoji.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index categories_family_id_idx on public.categories (family_id);

alter table public.categories enable row level security;

create policy "categories: read own family" on public.categories
  for select using (family_id = public.current_family_id());

create policy "categories: insert own family" on public.categories
  for insert with check (family_id = public.current_family_id());

create policy "categories: update own family" on public.categories
  for update using (family_id = public.current_family_id())
  with check (family_id = public.current_family_id());

-- No delete policy — matches chores' soft-archive-only convention
-- (active/archived_at), never a hard delete.

-- Nullable FK on chores: existing chores keep working unchanged (every
-- current row becomes NULL = "Uncategorized" automatically, no backfill).
-- on delete set null (not cascade) because losing a category is metadata
-- cleanup, not an ownership relationship — it must never delete the chore.
alter table public.chores
  add column category_id uuid references public.categories(id) on delete set null;

create index chores_category_id_idx on public.chores (category_id);

-- Kiosk board read model: add category info. Changing the OUT column list
-- requires DROP + CREATE — Postgres rejects changing a function's return
-- columns via CREATE OR REPLACE. Body is otherwise identical to
-- 0005_fix_kiosk_board_types.sql, the last revision.
drop function public.get_kiosk_board();

create function public.get_kiosk_board()
returns table (
  member_id uuid,
  member_name text,
  member_emoji text,
  member_color text,
  points_balance int,
  chore_id uuid,
  chore_name text,
  chore_emoji text,
  chore_notes text,
  chore_points int,
  category_id uuid,
  category_name text,
  frequency_type text,
  times_per_period int,
  interval_days int,
  completed_count int,
  remaining int,
  period_start timestamptz,
  period_end timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_tz text;
begin
  select timezone into v_tz from public.families where id = v_family_id;

  return query
  select
    fm.id, fm.display_name, fm.emoji, fm.color, fm.points_balance,
    c.id, c.name, c.emoji, c.notes, c.points,
    cat.id, cat.name,
    c.frequency_type, c.times_per_period::int, c.interval_days::int,
    coalesce(cc.completed_count, 0)::int,
    greatest(c.times_per_period::int - coalesce(cc.completed_count, 0), 0)::int,
    pb.period_start, pb.period_end
  from public.family_members fm
  join public.chores c on c.assigned_member_id = fm.id and c.active
  left join public.categories cat on cat.id = c.category_id
  cross join lateral public.chore_period_bounds(c.id, now()) pb
  left join lateral (
    select count(*)::int as completed_count
    from public.chore_completions cc2
    where cc2.chore_id = c.id and cc2.family_member_id = fm.id and cc2.period_start = pb.period_start
  ) cc on true
  where fm.family_id = v_family_id
    and fm.kind = 'kid'
    and fm.archived_at is null
    and (
      c.frequency_type not in ('weekdays', 'weekends')
      or (c.frequency_type = 'weekdays' and extract(dow from (now() at time zone v_tz)) between 1 and 5)
      or (c.frequency_type = 'weekends' and extract(dow from (now() at time zone v_tz)) in (0, 6))
    )
  order by fm.display_name, cat.name nulls last, c.created_at;
end;
$$;

grant execute on function public.get_kiosk_board() to authenticated;
