import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface PointsHistoryDay {
  day: string
  earned: number
  redeemed: number
}

export function usePointsHistory(days = 14) {
  return useQuery({
    queryKey: ['pointsHistory', days],
    queryFn: async (): Promise<PointsHistoryDay[]> => {
      const { data, error } = await supabase.rpc('get_points_history', { p_days: days })
      if (error) throw error
      return data
    },
  })
}
