import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../hooks/useSession'

function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (email.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setError("That's already your email.")
      return
    }
    setSubmitting(true)
    // Supabase doesn't switch the address until it's confirmed from the
    // emailed links. "Secure email change" is on, so both addresses have to
    // confirm; the UI tells the user to expect two emails.
    const { error: updateError } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: window.location.origin },
    )
    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setPendingEmail(email.trim())
    setEmail('')
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-slate-700">Email</h3>
        <p className="text-sm text-slate-500">Currently {currentEmail}</p>
      </div>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        New email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>
      <p className="text-xs text-slate-500">
        You'll need to approve the change from a link sent to both your current and your new email.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {pendingEmail && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          <p className="font-medium mb-1">Almost done. Check both inboxes.</p>
          <p>
            We sent a confirmation link to <strong>{currentEmail}</strong> and to{' '}
            <strong>{pendingEmail}</strong>. Click the link in <strong>both</strong> emails. Your email
            won't change until both are approved.
          </p>
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-lg bg-indigo-600 text-white text-sm font-medium px-3 py-1.5 disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Change email'}
      </button>
    </form>
  )
}

function ChangePasswordForm({ currentEmail }: { currentEmail: string }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaved(false)
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.")
      return
    }
    setSubmitting(true)
    // Supabase's updateUser doesn't ask for the old password, and the tablet
    // stays logged in where kids can reach it — so check it by signing in
    // again first (same user, so the session just refreshes).
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    })
    if (verifyError) {
      setSubmitting(false)
      setError('Current password is incorrect.')
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
      <h3 className="text-sm font-medium text-slate-700">Password</h3>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Current password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        New password
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
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
      {saved && <p className="text-sm text-green-700">Password updated.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-lg bg-indigo-600 text-white text-sm font-medium px-3 py-1.5 disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Change password'}
      </button>
    </form>
  )
}

export function AccountPage() {
  const { session, loading } = useSession()
  const email = session?.user.email

  if (loading || !email) {
    return <p className="text-slate-500">Loading…</p>
  }

  return (
    <div className="max-w-md flex flex-col gap-6">
      <p className="text-sm text-slate-500">
        These settings are for the parent account this device is logged in as.
      </p>
      <ChangeEmailForm currentEmail={email} />
      <ChangePasswordForm currentEmail={email} />
    </div>
  )
}
