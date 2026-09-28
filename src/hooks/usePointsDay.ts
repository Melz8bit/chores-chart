import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PointsDayKind, PointsMode } from '../lib/database.types'

export interface PointsDay {
  points_mode: PointsMode
  day_kind: PointsDayKind
}

export function usePointsDay() {
  return useQuery({
    queryKey: ['pointsDay'],
    queryFn: async (): Promise<PointsDay | null> => {
      const { data, error } = await supabase.rpc('get_points_day')
      if (error) throw error
      return data[0] ?? null
    },
    // Same reasoning as useKioskBoard: the kiosk stays open across the 8pm
    // points-day rollover and needs to notice it on its own.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

function invalidatePointsQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['pointsDay'] })
  queryClient.invalidateQueries({ queryKey: ['kioskBoard'] })
}

export function useSetHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ on, pin }: { on: boolean; pin: string | null }) => {
      const { error } = await supabase.rpc('set_holiday', { p_on: on, p_pin: pin })
      if (error) throw error
    },
    onSuccess: () => invalidatePointsQueries(queryClient),
  })
}

export function useSetPointsMode(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (mode: PointsMode) => {
      if (!familyId) throw new Error('No family loaded yet')
      const { error } = await supabase.from('families').update({ points_mode: mode }).eq('id', familyId)
      if (error) throw error
    },
    onSuccess: () => {
      invalidatePointsQueries(queryClient)
      queryClient.invalidateQueries({ queryKey: ['family', familyId] })
    },
  })
}
