import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { initialAuthHash, supabase } from '../lib/supabase'
import { useSession } from '../hooks/useSession'
import { AuthShell } from '../components/AuthShell'

// Supabase reports a bad or expired link in the URL hash instead of creating
// a session, e.g. #error=access_denied&error_code=otp_expired&error_description=...
const linkError = initialAuthHash.get('error_description') ?? initialAuthHash.get('error')
// Only a real emailed link may set a password without the current one —
// otherwise anyone on the logged-in kiosk tablet could open /reset-password
// directly and skip the current-password check on Settings > Account.
const openedFromRecoveryLink = initialAuthHash.get('type') === 'recovery'

// Landing page for the emailed reset link. supabase-js picks the recovery
// token out of the URL on load and signs the user in, so by the time the
// session has loaded this page only needs to set the new password.
export function ResetPasswordPage() {
  const { session, loading } = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }
    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    navigate('/', { replace: true })
  }

  if (loading) {
    return (
      <AuthShell>
        <p className="text-slate-500 text-center">Loading…</p>
      </AuthShell>
    )
  }

  if (linkError || !openedFromRecoveryLink || !session) {
    return (
      <AuthShell>
        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-xl font-semibold text-slate-900">This link didn't work</h1>
          <p className="text-slate-600">
            {linkError ?? 'Open this page from the link in your password reset email.'} Reset links
            expire, and each one only works once.
          </p>
          <Link to="/forgot-password" className="text-indigo-600 font-medium">
            Send a new link
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>
          <p className="text-sm text-slate-500 mt-1">For {session.user.email}</p>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          New password
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Confirm new password
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 text-white font-medium py-2 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthShell>
  )
}
