import { useState } from 'react'
import { useCurrentFamilyMember } from '../../hooks/useCurrentFamilyMember'
import { useArchiveCategory, useCategories } from '../../hooks/useCategories'
import { Modal } from '../../components/Modal'
import { CategoryForm } from '../../components/CategoryForm'
import type { Category } from '../../lib/database.types'

export function CategoriesPage() {
  const { familyMember } = useCurrentFamilyMember()
  const familyId = familyMember?.family_id
  const { data: categories = [], isLoading } = useCategories(familyId)
  const archiveCategory = useArchiveCategory(familyId)

  const [editingCategory, setEditingCategory] = useState<Category | 'new' | null>(null)

  if (isLoading) {
    return <p className="text-slate-500">Loading…</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Categories</h2>
        <button
          type="button"
          onClick={() => setEditingCategory('new')}
          className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-3 py-1.5"
        >
          + Add category
        </button>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <span className="text-slate-700">{category.name}</span>
            <div className="flex gap-3 text-sm">
              <button
                type="button"
                onClick={() => setEditingCategory(category)}
                className="text-indigo-600 font-medium"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Archive "${category.name}"? Chores in this category will move to Uncategorized. This can't be undone from here.`,
                    )
                  ) {
                    archiveCategory.mutate(category.id)
                  }
                }}
                className="text-slate-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
        {categories.length === 0 && (
          <p className="text-slate-500 col-span-full">No categories added yet.</p>
        )}
      </ul>

      {editingCategory && familyId && (
        <Modal
          title={editingCategory === 'new' ? 'Add category' : 'Edit category'}
          onClose={() => setEditingCategory(null)}
        >
          <CategoryForm
            familyId={familyId}
            existingCategory={editingCategory === 'new' ? undefined : editingCategory}
            onDone={() => setEditingCategory(null)}
            onCancel={() => setEditingCategory(null)}
          />
        </Modal>
      )}
    </div>
  )
}
