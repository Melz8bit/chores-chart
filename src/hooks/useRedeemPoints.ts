import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useRedeemPoints() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ memberId, amount }: { memberId: string; amount: number }) => {
      const { data, error } = await supabase.rpc('redeem_points', {
        p_family_member_id: memberId,
        p_amount: amount,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kioskBoard'] })
      queryClient.invalidateQueries({ queryKey: ['redemptionHistory'] })
    },
  })
}
