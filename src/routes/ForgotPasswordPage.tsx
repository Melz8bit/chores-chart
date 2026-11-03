import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AuthShell } from '../components/AuthShell'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    // The link lands on /reset-password, which must be in the Supabase
    // project's allowed redirect URLs (otherwise it falls back to Site URL).
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSubmitting(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSentTo(email.trim())
  }

  if (sentTo) {
    return (
      <AuthShell>
        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Check your email</h1>
          <p className="text-slate-600">
            If there's an account for <span className="font-medium">{sentTo}</span>, we sent it a link
            to reset your password. The link works on any device.
          </p>
          <Link to="/login" className="text-indigo-600 font-medium">
            Back to login
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter your account's email and we'll send you a link to choose a new password.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 text-white font-medium py-2 disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>

        <p className="text-sm text-slate-600 text-center">
          <Link to="/login" className="text-indigo-600 font-medium">
            Back to login
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
