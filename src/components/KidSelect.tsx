import { useEffect, useRef, useState } from 'react'
import type { FamilyMember } from '../lib/database.types'
import { KidAvatar } from './KidAvatar'

// A custom dropdown standing in for a native <select>, because <option>
// elements can only render plain text — a kid's emoji would fall back to
// the OS's native emoji font there, reintroducing the cross-device
// centering inconsistency the rest of the app just moved away from.
export function KidSelect({
  kids,
  value,
  onChange,
}: {
  kids: FamilyMember[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = kids.find((k) => k.id === value)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (kids.length === 0) {
    return (
      <div className="rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-400 bg-slate-50">
        Add a kid first
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-left"
      >
        {selected ? (
          <>
            <KidAvatar emoji={selected.emoji} color={selected.color} size="sm" />
            <span className="text-slate-800">{selected.display_name}</span>
          </>
        ) : (
          <span className="text-slate-400">Choose a kid</span>
        )}
        <span className="ml-auto text-slate-400">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {kids.map((kid) => (
            <li key={kid.id} role="option" aria-selected={kid.id === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(kid.id)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 ${
                  kid.id === value ? 'bg-indigo-50' : ''
                }`}
              >
                <KidAvatar emoji={kid.emoji} color={kid.color} size="sm" />
                <span className="text-slate-800">{kid.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
