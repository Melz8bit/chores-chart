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
          'id, name, timezone, week_start_day, invite_code, last_expired_date, points_mode, holiday_date, rollover_hour, created_at',
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
