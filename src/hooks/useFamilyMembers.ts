import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { FamilyMember } from '../lib/database.types'

export function useFamilyMembers(familyId: string | undefined) {
  return useQuery({
    queryKey: ['familyMembers', familyId],
    queryFn: async (): Promise<FamilyMember[]> => {
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', familyId as string)
        .is('archived_at', null)
        .order('kind', { ascending: true })
        .order('display_name', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!familyId,
  })
}

export function useAddKid(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { displayName: string; emoji: string; color: string }) => {
      if (!familyId) throw new Error('No family loaded yet')
      const { error } = await supabase.from('family_members').insert({
        family_id: familyId,
        kind: 'kid',
        display_name: input.displayName,
        emoji: input.emoji || null,
        color: input.color || null,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['familyMembers', familyId] }),
  })
}

export function useUpdateKid(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      memberId,
      input,
    }: {
      memberId: string
      input: { displayName: string; emoji: string; color: string }
    }) => {
      const { error } = await supabase
        .from('family_members')
        .update({
          display_name: input.displayName,
          emoji: input.emoji || null,
          color: input.color || null,
        })
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['familyMembers', familyId] }),
  })
}

export function useArchiveMember(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('family_members')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['familyMembers', familyId] }),
  })
}
