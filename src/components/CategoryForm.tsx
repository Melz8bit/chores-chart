import { useState, type FormEvent } from 'react'
import type { Category } from '../lib/database.types'
import { useAddCategory, useUpdateCategory } from '../hooks/useCategories'

export function CategoryForm({
  familyId,
  existingCategory,
  onDone,
  onCancel,
}: {
  familyId: string
  existingCategory?: Category
  onDone: () => void
  onCancel: () => void
}) {
  const addCategory = useAddCategory(familyId)
  const updateCategory = useUpdateCategory(familyId)

  const [name, setName] = useState(existingCategory?.name ?? '')
  const [error, setError] = useState<string | null>(null)

  const saving = addCategory.isPending || updateCategory.isPending

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      if (existingCategory) {
        await updateCategory.mutateAsync({ id: existingCategory.id, name })
      } else {
        await addCategory.mutateAsync(name)
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Kitchen"
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
          disabled={saving}
          className="rounded-lg bg-indigo-600 text-white font-medium px-4 py-2 disabled:opacity-50"
        >
          {saving ? 'Saving…' : existingCategory ? 'Save changes' : 'Add category'}
        </button>
      </div>
    </form>
  )
}
