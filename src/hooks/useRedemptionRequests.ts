import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { RedemptionRequestStatus } from '../lib/database.types'

export interface RedemptionRequestDetails {
  id: string
  family_member_id: string
  amount: number
  status: RedemptionRequestStatus
  requested_at: string
  decided_at: string | null
  kid_name: string
  kid_emoji: string | null
  kid_color: string | null
  kid_balance: number
  decided_by_name: string | null
}

// redemption_requests has two foreign keys to family_members (the kid and
// the deciding parent), so each embed names its constraint.
const SELECT = `id, family_member_id, amount, status, requested_at, decided_at,
  kid:family_members!redemption_requests_family_member_id_fkey(display_name, emoji, color, points_balance),
  decider:family_members!redemption_requests_decided_by_member_id_fkey(display_name)`

interface Row {
  id: string
  family_member_id: string
  amount: number
  status: RedemptionRequestStatus
  requested_at: string
  decided_at: string | null
  kid: { display_name: string; emoji: string | null; color: string | null; points_balance: number } | null
  decider: { display_name: string } | null
}

function toDetails(row: Row): RedemptionRequestDetails {
  return {
    id: row.id,
    family_member_id: row.family_member_id,
    amount: row.amount,
    status: row.status,
    requested_at: row.requested_at,
    decided_at: row.decided_at,
    kid_name: row.kid?.display_name ?? 'Unknown',
    kid_emoji: row.kid?.emoji ?? null,
    kid_color: row.kid?.color ?? null,
    kid_balance: row.kid?.points_balance ?? 0,
    decided_by_name: row.decider?.display_name ?? null,
  }
}

// Pending requests for the kiosk. Polled so a request approved from a
// parent's phone clears off the tablet within a few seconds.
export function usePendingRedemptions(familyId: string | undefined) {
  return useQuery({
    queryKey: ['redemptionRequests', 'pending', familyId],
    queryFn: async (): Promise<RedemptionRequestDetails[]> => {
      const { data, error } = await supabase
        .from('redemption_requests')
        .select(SELECT)
        .eq('status', 'pending')
        .order('requested_at')
      if (error) throw error
      return (data as unknown as Row[]).map(toDetails)
    },
    enabled: !!familyId,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  })
}

export function useRedemptionRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: ['redemptionRequests', 'one', requestId],
    queryFn: async (): Promise<RedemptionRequestDetails | null> => {
      const { data, error } = await supabase
        .from('redemption_requests')
        .select(SELECT)
        .eq('id', requestId as string)
        .maybeSingle()
      if (error) throw error
      return data ? toDetails(data as unknown as Row) : null
    },
    enabled: !!requestId,
    refetchOnWindowFocus: true,
  })
}

function useInvalidateRedemptions() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['redemptionRequests'] })
    queryClient.invalidateQueries({ queryKey: ['kioskBoard'] })
    queryClient.invalidateQueries({ queryKey: ['redemptionHistory'] })
  }
}

export function useRequestRedemption() {
  const invalidate = useInvalidateRedemptions()
  return useMutation({
    mutationFn: async ({ memberId, amount }: { memberId: string; amount: number }) => {
      const { error } = await supabase.rpc('request_redemption', {
        p_family_member_id: memberId,
        p_amount: amount,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// Needs either the family's Settings PIN or this device's approval key
// (registered parent phones); the server checks both.
export function useDecideRedemption() {
  const invalidate = useInvalidateRedemptions()
  return useMutation({
    mutationFn: async ({
      requestId,
      approve,
      pin = null,
      deviceKey = null,
    }: {
      requestId: string
      approve: boolean
      pin?: string | null
      deviceKey?: string | null
    }) => {
      const { error } = await supabase.rpc('decide_redemption', {
        p_request_id: requestId,
        p_approve: approve,
        p_pin: pin,
        p_device_key: deviceKey,
      })
      if (error) throw error
    },
    onSettled: invalidate,
  })
}
