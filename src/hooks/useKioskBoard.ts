import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ChoreFrequencyType } from '../lib/database.types'

export interface KioskBoardRow {
  member_id: string
  member_name: string
  member_emoji: string | null
  member_color: string | null
  points_balance: number
  chore_id: string
  chore_name: string
  chore_emoji: string | null
  chore_notes: string | null
  chore_points: number
  category_id: string | null
  category_name: string | null
  frequency_type: ChoreFrequencyType
  times_per_period: number
  interval_days: number | null
  completed_count: number
  remaining: number
  period_start: string
  period_end: string
}

export function useKioskBoard() {
  return useQuery({
    queryKey: ['kioskBoard'],
    queryFn: async (): Promise<KioskBoardRow[]> => {
      const { data, error } = await supabase.rpc('get_kiosk_board')
      if (error) throw error
      return data
    },
    // The kiosk tablet is typically left open indefinitely, so it needs to
    // notice period rollovers (midnight, week/month boundaries) on its own.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}
