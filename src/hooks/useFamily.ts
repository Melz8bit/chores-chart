import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Family } from '../lib/database.types'

export function useFamily(familyId: string | undefined) {
  return useQuery({
    queryKey: ['family', familyId],
    queryFn: async (): Promise<Family> => {
      const { data, error } = await supabase
        .from('families')
        .select(
          'id, name, timezone, week_start_day, invite_code, last_expired_date, points_mode, holiday_date, rollover_hour, daily_report_hour, last_daily_report_date, created_at',
        )
        .eq('id', familyId as string)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!familyId,
  })
}

export function useRenameFamily(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      if (!familyId) throw new Error('No family loaded yet')
      const { error } = await supabase.from('families').update({ name }).eq('id', familyId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['family', familyId] }),
  })
}

// Local hour (12-23) the daily report goes out to parents who opted in.
export function useSetDailyReportHour(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (hour: number) => {
      if (!familyId) throw new Error('No family loaded yet')
      const { error } = await supabase.from('families').update({ daily_report_hour: hour }).eq('id', familyId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['family', familyId] }),
  })
}

// The signed-in parent's own daily report opt-in (family_members.daily_report).
// Goes through an RPC because family_members updates are column-limited (0031).
export function useSetDailyReportOptIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.rpc('set_daily_report', { p_enabled: enabled })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currentFamilyMember'] }),
  })
}
