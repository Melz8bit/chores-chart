import { useState } from 'react'
import { useCurrentFamilyMember } from '../../hooks/useCurrentFamilyMember'
import { useArchiveMember, useFamilyMembers } from '../../hooks/useFamilyMembers'
import { Modal } from '../../components/Modal'
import { KidForm } from '../../components/KidForm'
import { KidAvatar } from '../../components/KidAvatar'
import type { FamilyMember } from '../../lib/database.types'

export function MembersPage() {
  const { familyMember } = useCurrentFamilyMember()
  const familyId = familyMember?.family_id
  const { data: members = [], isLoading } = useFamilyMembers(familyId)
  const archiveMember = useArchiveMember(familyId)

  const [editingKid, setEditingKid] = useState<FamilyMember | 'new' | null>(null)

  const parents = members.filter((m) => m.kind === 'parent')
  const kids = members.filter((m) => m.kind === 'kid')

  if (isLoading) {
    return <p className="text-slate-500">Loading…</p>
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Parents</h2>
        <ul className="flex flex-col gap-2">
          {parents.map((parent) => (
            <li
              key={parent.id}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700"
            >
              {parent.display_name}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Kids</h2>
          <button
            type="button"
            onClick={() => setEditingKid('new')}
            className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-3 py-1.5"
          >
            + Add kid
          </button>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {kids.map((kid) => (
            <li
              key={kid.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <span className="flex items-center gap-2 text-slate-700">
                <KidAvatar emoji={kid.emoji} color={kid.color} size="md" />
                {kid.display_name}
              </span>
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setEditingKid(kid)}
                  className="text-indigo-600 font-medium"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        `Remove ${kid.display_name}? Their chores will stay assigned to them but they'll disappear from the board. This can't be undone from here.`,
                      )
                    ) {
                      archiveMember.mutate(kid.id)
                    }
                  }}
                  className="text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
          {kids.length === 0 && <p className="text-slate-500 col-span-full">No kids added yet.</p>}
        </ul>
      </section>

      {editingKid && familyId && (
        <Modal
          title={editingKid === 'new' ? 'Add kid' : 'Edit kid'}
          onClose={() => setEditingKid(null)}
        >
          <KidForm
            familyId={familyId}
            existingKid={editingKid === 'new' ? undefined : editingKid}
            onDone={() => setEditingKid(null)}
            onCancel={() => setEditingKid(null)}
          />
        </Modal>
      )}
    </div>
  )
}
