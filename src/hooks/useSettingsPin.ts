import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useHasSettingsPin(familyId: string | undefined) {
  return useQuery({
    queryKey: ['hasSettingsPin', familyId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('has_settings_pin')
      if (error) throw error
      return data
    },
    enabled: !!familyId,
  })
}

export function useVerifySettingsPin() {
  return useMutation({
    mutationFn: async (pin: string): Promise<boolean> => {
      const { data, error } = await supabase.rpc('verify_settings_pin', { p_pin: pin })
      if (error) throw error
      return data
    },
  })
}

export function useSetSettingsPin(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pin: string | null) => {
      if (!familyId) throw new Error('No family loaded yet')
      const { error } = await supabase.from('families').update({ settings_pin: pin }).eq('id', familyId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hasSettingsPin', familyId] }),
  })
}
