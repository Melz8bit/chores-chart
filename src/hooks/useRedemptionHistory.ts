import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface RedemptionHistoryEntry {
  id: string
  amount: number
  created_at: string
  member_name: string
  member_emoji: string | null
  member_color: string | null
}

export function useRedemptionHistory(familyId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['redemptionHistory', familyId, limit],
    queryFn: async (): Promise<RedemptionHistoryEntry[]> => {
      const { data, error } = await supabase
        .from('point_transactions')
        .select('id, amount, created_at, family_members(display_name, emoji, color)')
        .eq('family_id', familyId as string)
        .eq('type', 'redeemed')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data.map((row) => {
        const member = Array.isArray(row.family_members) ? row.family_members[0] : row.family_members
        return {
          id: row.id,
          amount: row.amount,
          created_at: row.created_at,
          member_name: member?.display_name ?? 'Unknown',
          member_emoji: member?.emoji ?? null,
          member_color: member?.color ?? null,
        }
      })
    },
    enabled: !!familyId,
  })
}
