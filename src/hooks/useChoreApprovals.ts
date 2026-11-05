import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ChoreApprovalStatus } from '../lib/database.types'

export interface ChoreApprovalDetails {
  id: string
  chore_id: string
  family_member_id: string
  points: number
  status: ChoreApprovalStatus
  requested_at: string
  decided_at: string | null
  chore_name: string
  chore_emoji: string | null
  kid_name: string
  kid_emoji: string | null
  kid_color: string | null
  decided_by_name: string | null
}

// chore_approval_requests has two foreign keys to family_members (the kid
// and the deciding parent), so each embed names its constraint.
const SELECT = `id, chore_id, family_member_id, points, status, requested_at, decided_at,
  chore:chores(name, emoji),
  kid:family_members!chore_approval_requests_family_member_id_fkey(display_name, emoji, color),
  decider:family_members!chore_approval_requests_decided_by_member_id_fkey(display_name)`

interface Row {
  id: string
  chore_id: string
  family_member_id: string
  points: number
  status: ChoreApprovalStatus
  requested_at: string
  decided_at: string | null
  chore: { name: string; emoji: string | null } | null
  kid: { display_name: string; emoji: string | null; color: string | null } | null
  decider: { display_name: string } | null
}

function toDetails(row: Row): ChoreApprovalDetails {
  return {
    id: row.id,
    chore_id: row.chore_id,
    family_member_id: row.family_member_id,
    points: row.points,
    status: row.status,
    requested_at: row.requested_at,
    decided_at: row.decided_at,
    chore_name: row.chore?.name ?? 'A chore',
    chore_emoji: row.chore?.emoji ?? null,
    kid_name: row.kid?.display_name ?? 'Unknown',
    kid_emoji: row.kid?.emoji ?? null,
    kid_color: row.kid?.color ?? null,
    decided_by_name: row.decider?.display_name ?? null,
  }
}

// Pending requests for the kiosk. Polled so a chore approved from a parent's
// phone shows up on the tablet within a few seconds.
export function usePendingChoreApprovals(familyId: string | undefined) {
  return useQuery({
    queryKey: ['choreApprovals', 'pending', familyId],
    queryFn: async (): Promise<ChoreApprovalDetails[]> => {
      const { data, error } = await supabase
        .from('chore_approval_requests')
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

export function useChoreApproval(requestId: string | undefined) {
  return useQuery({
    queryKey: ['choreApprovals', 'one', requestId],
    queryFn: async (): Promise<ChoreApprovalDetails | null> => {
      const { data, error } = await supabase
        .from('chore_approval_requests')
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

function useInvalidateChoreApprovals() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['choreApprovals'] })
    queryClient.invalidateQueries({ queryKey: ['kioskBoard'] })
  }
}

export function useRequestChoreApproval() {
  const invalidate = useInvalidateChoreApprovals()
  return useMutation({
    mutationFn: async ({ choreId, memberId }: { choreId: string; memberId: string }) => {
      const { error } = await supabase.rpc('request_chore_approval', {
        p_chore_id: choreId,
        p_family_member_id: memberId,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// Needs either the family's Settings PIN or this device's approval key
// (registered parent phones); the server checks both.
export function useDecideChoreApproval() {
  const invalidate = useInvalidateChoreApprovals()
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
      const { error } = await supabase.rpc('decide_chore_approval', {
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
