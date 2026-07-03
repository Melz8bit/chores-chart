import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { FamilyMember } from '../lib/database.types'
import { useSession } from './useSession'

export function useCurrentFamilyMember() {
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id

  const query = useQuery({
    queryKey: ['currentFamilyMember', userId],
    queryFn: async (): Promise<FamilyMember | null> => {
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!userId,
  })

  return {
    session,
    sessionLoading,
    familyMember: query.data ?? null,
    familyMemberLoading: query.isLoading,
    refetch: query.refetch,
  }
}
