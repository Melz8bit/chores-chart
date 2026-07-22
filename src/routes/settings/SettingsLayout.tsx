import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/settings/members', label: 'Members' },
  { to: '/settings/categories', label: 'Categories' },
  { to: '/settings/chores', label: 'Chores' },
  { to: '/settings/family', label: 'Family' },
]

export function SettingsLayout() {
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
