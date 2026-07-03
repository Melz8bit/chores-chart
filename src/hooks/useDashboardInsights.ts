import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface DashboardInsight {
  chore_id: string
  chore_name: string
  chore_emoji: string | null
  member_id: string
  member_name: string
  insight_type: 'ignored' | 'under_completed'
  detail: string
}

export function useDashboardInsights() {
  return useQuery({
    queryKey: ['dashboardInsights'],
    queryFn: async (): Promise<DashboardInsight[]> => {
      const { data, error } = await supabase.rpc('get_dashboard_insights')
      if (error) throw error
      return data
    },
  })
}
