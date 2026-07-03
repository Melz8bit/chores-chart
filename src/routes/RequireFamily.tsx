import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentFamilyMember } from '../hooks/useCurrentFamilyMember'

export function RequireFamily({ children }: { children: ReactNode }) {
  const { session, sessionLoading, familyMember, familyMemberLoading } = useCurrentFamilyMember()

  if (sessionLoading || (session && familyMemberLoading)) {
    return (
      <div className="min-h-svh flex items-center justify-center text-slate-500">Loading…</div>
    )
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  if (!familyMember) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
