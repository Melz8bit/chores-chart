import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useCompleteChore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ choreId, memberId }: { choreId: string; memberId: string }) => {
      const { data, error } = await supabase.rpc('complete_chore', {
        p_chore_id: choreId,
        p_family_member_id: memberId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kioskBoard'] })
    },
  })
}
