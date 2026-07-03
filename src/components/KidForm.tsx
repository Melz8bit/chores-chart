import { useState, type FormEvent } from 'react'
import type { FamilyMember } from '../lib/database.types'
import { useAddKid, useUpdateKid } from '../hooks/useFamilyMembers'
import { EmojiPicker } from './EmojiPicker'

const KID_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6']

export function KidForm({
  familyId,
  existingKid,
  onDone,
  onCancel,
}: {
  familyId: string
  existingKid?: FamilyMember
  onDone: () => void
  onCancel: () => void
}) {
  const addKid = useAddKid(familyId)
  const updateKid = useUpdateKid(familyId)

  const [displayName, setDisplayName] = useState(existingKid?.display_name ?? '')
  const [emoji, setEmoji] = useState(existingKid?.emoji ?? '')
  const [color, setColor] = useState(existingKid?.color ?? KID_COLORS[0])
  const [error, setError] = useState<string | null>(null)

  const saving = addKid.isPending || updateKid.isPending

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      if (existingKid) {
        await updateKid.mutateAsync({ memberId: existingKid.id, input: { displayName, emoji, color } })
      } else {
        await addKid.mutateAsync({ displayName, emoji, color })
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Name
        <input
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>

      <EmojiPicker value={emoji} onChange={setEmoji} label="Avatar" />

      <div>
        <span className="block text-sm text-slate-700 mb-1">Color</span>
        <div className="flex gap-1.5">
          {KID_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-slate-900' : ''}`}
              aria-label={`Choose color ${c}`}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-slate-600 font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 text-white font-medium px-4 py-2 disabled:opacity-50"
        >
          {saving ? 'Saving…' : existingKid ? 'Save changes' : 'Add kid'}
        </button>
      </div>
    </form>
  )
}
