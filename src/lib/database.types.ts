// Hand-written to match supabase/migrations/*.sql — there's no CLI link to the
// project yet to run `supabase gen types typescript`. Regenerate from the real
// schema once that's possible; keep this in sync with new migrations until then.

export type FamilyMemberKind = 'parent' | 'kid'

export type ChoreFrequencyType =
  | 'daily'
  | 'weekdays'
  | 'weekends'
  | 'weekly'
  | 'monthly'
  | 'every_n_days'

export type PointTransactionType = 'earned' | 'redeemed' | 'expired'

export interface Family {
  id: string
  name: string
  timezone: string
  week_start_day: number
  invite_code: string
  last_expired_date: string | null
  created_at: string
}

export interface FamilyMember {
  id: string
  family_id: string
  auth_user_id: string | null
  kind: FamilyMemberKind
  display_name: string
  emoji: string | null
  color: string | null
  points_balance: number
  archived_at: string | null
  created_at: string
}

export interface Category {
  id: string
  family_id: string
  name: string
  active: boolean
  archived_at: string | null
  created_at: string
}

export interface Chore {
  id: string
  family_id: string
  assigned_member_id: string
  name: string
  emoji: string | null
  notes: string | null
  points: number
  frequency_type: ChoreFrequencyType
  times_per_period: number
  interval_days: number | null
  anchor_date: string | null
  category_id: string | null
  active: boolean
  archived_at: string | null
  created_at: string
}

export interface ChoreCompletion {
  id: string
  chore_id: string
  family_id: string
  family_member_id: string
  created_by_member_id: string | null
  points_awarded: number
  period_start: string
  completed_at: string
}

export interface PointTransaction {
  id: string
  family_id: string
  family_member_id: string
  type: PointTransactionType
  amount: number
  related_chore_completion_id: string | null
  note: string | null
  created_at: string
}
