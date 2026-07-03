import { useState } from 'react'
import { useCurrentFamilyMember } from '../../hooks/useCurrentFamilyMember'
import { useFamilyMembers } from '../../hooks/useFamilyMembers'
import { useArchiveChore, useChores } from '../../hooks/useChores'
import { describeFrequency } from '../../lib/choreFrequency'
import { Modal } from '../../components/Modal'
import { ChoreForm } from '../../components/ChoreForm'
import { KidAvatar } from '../../components/KidAvatar'
import { Emoji } from '../../components/Emoji'
import type { Chore } from '../../lib/database.types'

export function ChoresPage() {
  const { familyMember } = useCurrentFamilyMember()
  const familyId = familyMember?.family_id
  const { data: members = [] } = useFamilyMembers(familyId)
  const { data: chores = [], isLoading } = useChores(familyId)
  const archiveChore = useArchiveChore(familyId)

  const kids = members.filter((m) => m.kind === 'kid')
  const [editingChore, setEditingChore] = useState<Chore | 'new' | null>(null)

  if (isLoading) {
    return <p className="text-slate-500">Loading…</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Chores</h2>
        <button
          type="button"
          onClick={() => setEditingChore('new')}
          disabled={kids.length === 0}
          className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-3 py-1.5 disabled:opacity-50"
        >
          + Add chore
        </button>
      </div>

      {kids.length === 0 && (
        <p className="text-slate-500 mb-4">Add a kid on the Members tab before creating chores.</p>
      )}

      {kids.map((kid) => {
        const kidChores = chores.filter((c) => c.assigned_member_id === kid.id)
        if (kidChores.length === 0) return null

        return (
          <section key={kid.id} className="mb-6">
            <h3 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
              <KidAvatar emoji={kid.emoji} color={kid.color} size="sm" />
              {kid.display_name}
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {kidChores.map((chore) => (
                <li
                  key={chore.id}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800 inline-flex items-center gap-1.5">
                      {chore.emoji && <Emoji emoji={chore.emoji} className="h-4 w-4" />}
                      {chore.name}
                    </span>
                    <span className="text-sm font-semibold text-indigo-600">
                      {chore.points} pts
                    </span>
                  </div>
                  <span className="text-sm text-slate-500">{describeFrequency(chore)}</span>
                  <div className="flex justify-end gap-3 mt-2 text-sm">
                    <button
                      type="button"
                      onClick={() => setEditingChore(chore)}
                      className="text-indigo-600 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove "${chore.name}"? This can't be undone from here.`)) {
                          archiveChore.mutate(chore.id)
                        }
                      }}
                      className="text-slate-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {editingChore && familyId && (
        <Modal
          title={editingChore === 'new' ? 'Add chore' : 'Edit chore'}
          onClose={() => setEditingChore(null)}
        >
          <ChoreForm
            familyId={familyId}
            kids={kids}
            existingChore={editingChore === 'new' ? undefined : editingChore}
            onDone={() => setEditingChore(null)}
            onCancel={() => setEditingChore(null)}
          />
        </Modal>
      )}
    </div>
  )
}
