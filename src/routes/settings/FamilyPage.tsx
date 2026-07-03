import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Family } from '../../lib/database.types'
import { useCurrentFamilyMember } from '../../hooks/useCurrentFamilyMember'

export function FamilyPage() {
  const { familyMember } = useCurrentFamilyMember()
  const familyId = familyMember?.family_id
  const [copied, setCopied] = useState(false)

  const { data: family, isLoading } = useQuery({
    queryKey: ['family', familyId],
    queryFn: async (): Promise<Family> => {
      const { data, error } = await supabase
        .from('families')
        .select('*')
        .eq('id', familyId as string)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!familyId,
  })

  if (isLoading || !family) {
    return <p className="text-slate-500">Loading…</p>
  }

  async function copyCode() {
    await navigator.clipboard.writeText(family!.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="max-w-md flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">{family.name}</h2>
        <p className="text-sm text-slate-500">Timezone: {family.timezone}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600 mb-2">
          Share this code with the other parent so they can join your family:
        </p>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-mono font-semibold tracking-widest text-slate-900">
            {family.invite_code}
          </span>
          <button
            type="button"
            onClick={copyCode}
            className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-3 py-1.5"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
