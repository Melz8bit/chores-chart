import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCurrentFamilyMember } from '../hooks/useCurrentFamilyMember'

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

export function OnboardingPage() {
  const { session, sessionLoading, familyMember, familyMemberLoading, refetch } =
    useCurrentFamilyMember()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [displayName, setDisplayName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!sessionLoading && !session) {
    return <Navigate to="/login" replace />
  }
  if (!familyMemberLoading && familyMember) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: rpcError } =
      mode === 'create'
        ? await supabase.rpc('create_family', {
            p_family_name: familyName,
            p_timezone: browserTimezone,
            p_parent_display_name: displayName,
          })
        : await supabase.rpc('join_family', {
            p_invite_code: inviteCode,
            p_parent_display_name: displayName,
          })

    setSubmitting(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }

    await refetch()
    navigate('/')
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col gap-4"
      >
        <h1 className="text-2xl font-semibold text-slate-900">Set up your family</h1>

        <div className="flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 rounded-md py-1.5 ${mode === 'create' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            Create a family
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 rounded-md py-1.5 ${mode === 'join' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            Join a family
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Your name (as a parent)
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>

        {mode === 'create' ? (
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Family name
            <input
              required
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="The Smiths"
              className="rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Invite code
            <input
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="rounded-lg border border-slate-300 px-3 py-2 text-base uppercase tracking-widest"
            />
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 text-white font-medium py-2 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : mode === 'create' ? 'Create family' : 'Join family'}
        </button>
      </form>
    </div>
  )
}
