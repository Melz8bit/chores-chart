import { useState, type FormEvent } from 'react'
import type { Category, Chore, ChoreFrequencyType, FamilyMember } from '../lib/database.types'
import { FREQUENCY_OPTIONS, timesPerPeriodLabel } from '../lib/choreFrequency'
import { useAddChore, useUpdateChore, type ChoreInput } from '../hooks/useChores'
import { EmojiPicker } from './EmojiPicker'
import { KidSelect } from './KidSelect'

export function ChoreForm({
  familyId,
  kids,
  categories,
  existingChore,
  onDone,
  onCancel,
}: {
  familyId: string
  kids: FamilyMember[]
  categories: Category[]
  existingChore?: Chore
  onDone: () => void
  onCancel: () => void
}) {
  const addChore = useAddChore(familyId)
  const updateChore = useUpdateChore(familyId)

  const [assignedMemberId, setAssignedMemberId] = useState(
    existingChore?.assigned_member_id ?? kids[0]?.id ?? '',
  )
  const [name, setName] = useState(existingChore?.name ?? '')
  const [emoji, setEmoji] = useState(existingChore?.emoji ?? '')
  const [notes, setNotes] = useState(existingChore?.notes ?? '')
  const [points, setPoints] = useState(existingChore?.points ?? 10)
  const [frequencyType, setFrequencyType] = useState<ChoreFrequencyType>(
    existingChore?.frequency_type ?? 'daily',
  )
  const [timesPerPeriod, setTimesPerPeriod] = useState(existingChore?.times_per_period ?? 1)
  const [intervalDays, setIntervalDays] = useState(existingChore?.interval_days ?? 2)
  const [anchorDate, setAnchorDate] = useState(
    existingChore?.anchor_date ?? new Date().toISOString().slice(0, 10),
  )
  const [categoryId, setCategoryId] = useState(existingChore?.category_id ?? '')
  const [error, setError] = useState<string | null>(null)

  const saving = addChore.isPending || updateChore.isPending

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!assignedMemberId) {
      setError('Add a kid before creating a chore.')
      return
    }

    const input: ChoreInput = {
      assignedMemberId,
      name,
      emoji,
      notes,
      points,
      frequencyType,
      timesPerPeriod,
      intervalDays: frequencyType === 'every_n_days' ? intervalDays : null,
      anchorDate: frequencyType === 'every_n_days' ? anchorDate : null,
      categoryId: categoryId || null,
    }

    try {
      if (existingChore) {
        await updateChore.mutateAsync({ id: existingChore.id, input })
      } else {
        await addChore.mutateAsync(input)
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm text-slate-700">
        Assigned to
        <KidSelect kids={kids} value={assignedMemberId} onChange={setAssignedMemberId} />
      </div>

      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Chore name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Make bed"
          className="rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>

      <EmojiPicker value={emoji} onChange={setEmoji} label="Emoji" />

      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Category
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-base"
        >
          <option value="">Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Points
        <input
          required
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Frequency
          <select
            value={frequencyType}
            onChange={(e) => setFrequencyType(e.target.value as ChoreFrequencyType)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {timesPerPeriodLabel(frequencyType)}
          <input
            type="number"
            min={1}
            value={timesPerPeriod}
            onChange={(e) => setTimesPerPeriod(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>
      </div>

      {frequencyType === 'every_n_days' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Every how many days
            <input
              required
              type="number"
              min={2}
              value={intervalDays}
              onChange={(e) => setIntervalDays(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Starting on
            <input
              required
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
          </label>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>

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
          disabled={saving || kids.length === 0}
          className="rounded-lg bg-indigo-600 text-white font-medium px-4 py-2 disabled:opacity-50"
        >
          {saving ? 'Saving…' : existingChore ? 'Save changes' : 'Add chore'}
        </button>
      </div>
    </form>
  )
}
