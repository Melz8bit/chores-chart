-- chores-chart: core schema
-- Run this in the Supabase SQL Editor first, then 0002_rls_and_auth.sql.

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/New_York',
  week_start_day smallint not null default 0 check (week_start_day between 0 and 6),
  invite_code text not null unique,
  last_expired_date date,
  created_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  kind text not null check (kind in ('parent', 'kid')),
  display_name text not null,
  emoji text,
  color text,
  points_balance int not null default 0 check (points_balance >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint kid_has_no_auth check (kind = 'parent' or auth_user_id is null)
);

create index family_members_family_id_idx on public.family_members (family_id);

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  assigned_member_id uuid not null references public.family_members(id) on delete cascade,
  name text not null,
  emoji text,
  notes text,
  points int not null check (points > 0),
  frequency_type text not null check (
    frequency_type in ('daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'every_n_days')
  ),
  times_per_period smallint not null default 1 check (times_per_period >= 1),
  interval_days smallint check (interval_days > 0),
  anchor_date date,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint every_n_days_requires_fields check (
    (frequency_type = 'every_n_days' and interval_days is not null and anchor_date is not null)
    or (frequency_type <> 'every_n_days')
  )
);

create index chores_family_id_idx on public.chores (family_id);
create index chores_assigned_member_id_idx on public.chores (assigned_member_id);

create table public.chore_completions (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chores(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  created_by_member_id uuid references public.family_members(id) on delete set null,
  points_awarded int not null,
  period_start timestamptz not null,
  completed_at timestamptz not null default now()
);

create index chore_completions_period_idx
  on public.chore_completions (chore_id, family_member_id, period_start);
create index chore_completions_family_completed_idx
  on public.chore_completions (family_id, completed_at);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  type text not null check (type in ('earned', 'redeemed', 'expired')),
  amount int not null,
  related_chore_completion_id uuid references public.chore_completions(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index point_transactions_family_created_idx on public.point_transactions (family_id, created_at);
create index point_transactions_member_created_idx on public.point_transactions (family_member_id, created_at);
