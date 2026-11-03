import type { ReactNode } from 'react'

// Shared frame for the logged-out pages (login, signup, password reset):
// the app icon and name above a centered card.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-6 bg-slate-50 px-4 py-8">
      <div className="flex flex-col items-center gap-3">
        <img src="/favicon.svg" alt="" className="h-20 w-20 rounded-[22%] shadow-md" />
        <p className="text-2xl font-bold tracking-tight text-indigo-600">Chores Chart</p>
      </div>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        {children}
      </div>
    </div>
  )
}
