import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Category } from '../lib/database.types'

export function useCategories(familyId: string | undefined) {
  return useQuery({
    queryKey: ['categories', familyId],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('family_id', familyId as string)
        .eq('active', true)
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!familyId,
  })
}

export function useAddCategory(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      if (!familyId) throw new Error('No family loaded yet')
      const { error } = await supabase.from('categories').insert({ family_id: familyId, name })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', familyId] }),
  })
}

export function useUpdateCategory(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('categories').update({ name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', familyId] }),
  })
}

// Archiving a category must not silently remove still-referencing active
// chores from the chore management page, so chores pointing at it are
// reassigned to Uncategorized (category_id = null) first. This keeps
// "archived category" meaning "fully unreferenced" at all times.
export function useArchiveCategory(familyId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (categoryId: string) => {
      if (!familyId) throw new Error('No family loaded yet')
      const { error: reassignError } = await supabase
        .from('chores')
        .update({ category_id: null })
        .eq('category_id', categoryId)
        .eq('family_id', familyId)
      if (reassignError) throw reassignError

      const { error } = await supabase
        .from('categories')
        .update({ active: false, archived_at: new Date().toISOString() })
        .eq('id', categoryId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', familyId] })
      queryClient.invalidateQueries({ queryKey: ['chores', familyId] })
    },
  })
}
