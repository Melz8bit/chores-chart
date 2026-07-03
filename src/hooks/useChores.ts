import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Chore, ChoreFrequencyType } from '../lib/database.types'

export interface ChoreInput {
  assignedMemberId: string
  name: string
  emoji: string
  notes: string
  points: number
  frequencyType: ChoreFrequencyType
  timesPerPeriod: number
  intervalDays: number | null
  anchorDate: string | null
}

function toRow(familyId: string, input: ChoreInput) {
  return {
    family_id: familyId,
    assigned_member_id: input.assignedMemberId,
    name: input.name,
    emoji: input.emoji || null,
    notes: input.notes || null,
    points: input.points,
    frequency_type: input.frequencyType,
    times_per_period: input.timesPerPeriod,
    interval_days: input.frequencyType === 'every_n_days' ? input.intervalDays : null,
    anchor_date: input.frequencyType === 'every_n_days' ? input.anchorDate : null,
  }
}

export function useChores(familyId: string | undefined) {
  return useQuery({
    queryKey: ['chores', familyId],
    queryFn: async (): Promise<Chore[]> => {
      const { data, error } = await supabase
        .from('chores')
        .select('*')
        .eq('family_id', familyId as string)
        .eq('active', true)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!familyId,
  })
}

export function useAddChore(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ChoreInput) => {
      if (!familyId) throw new Error('No family loaded yet')
      const { error } = await supabase.from('chores').insert(toRow(familyId, input))
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chores', familyId] }),
  })
}

export function useUpdateChore(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ChoreInput }) => {
      if (!familyId) throw new Error('No family loaded yet')
      const { error } = await supabase.from('chores').update(toRow(familyId, input)).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chores', familyId] }),
  })
}

export function useArchiveChore(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (choreId: string) => {
      const { error } = await supabase
        .from('chores')
        .update({ active: false, archived_at: new Date().toISOString() })
        .eq('id', choreId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chores', familyId] }),
  })
}
