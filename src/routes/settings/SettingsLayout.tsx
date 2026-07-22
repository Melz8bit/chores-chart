import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useCurrentFamilyMember } from '../../hooks/useCurrentFamilyMember'
import { useHasSettingsPin, useVerifySettingsPin } from '../../hooks/useSettingsPin'
import { PinKeypad } from '../../components/PinKeypad'

const TABS = [
  { to: '/settings/members', label: 'Members' },
  { to: '/settings/categories', label: 'Categories' },
  { to: '/settings/chores', label: 'Chores' },
  { to: '/settings/family', label: 'Family' },
]

export function SettingsLayout() {
  const { familyMember } = useCurrentFamilyMember()
  const familyId = familyMember?.family_id
  const { data: hasPin, isLoading } = useHasSettingsPin(familyId)
  const verifyPin = useVerifySettingsPin()
  const [unlocked, setUnlocked] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

  async function handlePinComplete(pin: string) {
    setPinError(null)
    try {
      const ok = await verifyPin.mutateAsync(pin)
      if (ok) {
        setUnlocked(true)
      } else {
        setPinError('Incorrect PIN, try again.')
      }
    } catch {
      setPinError('Something went wrong.')
    }
  }

  if (isLoading) {
    return <div className="min-h-svh bg-slate-50" />
  }

  // Kids share the same logged-in tablet as parents, so Settings is gated
  // by a PIN rather than by Supabase auth — a UI speedbump, not a security
  // boundary. Re-checked on every visit (no persisted "unlocked" state).
  if (hasPin && !unlocked) {
    return (
      <div className="min-h-svh bg-slate-50 flex flex-col items-center justify-center gap-6 px-4">
        <div className="text-center">
          <p className="text-4xl mb-2">🔒</p>
          <h1 className="text-xl font-semibold text-slate-900">Enter parent PIN</h1>
        </div>
        <PinKeypad onComplete={handlePinComplete} error={pinError} />
        <NavLink to="/" className="text-sm text-indigo-600 font-medium">
          ← Back to board
        </NavLink>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 sm:px-8 py-4 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <NavLink to="/" className="text-sm text-indigo-600 font-medium">
          ← Back to board
        </NavLink>
      </header>

      <nav className="flex gap-1 px-4 sm:px-8 pt-4 flex-wrap">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `rounded-t-lg px-4 py-2 text-sm font-medium ${
                isActive ? 'bg-white text-indigo-600 border border-b-0 border-slate-200' : 'text-slate-500'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main className="bg-white border-t border-slate-200 px-4 sm:px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
