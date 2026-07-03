import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../hooks/useSession'

export function SignupPage() {
  const { session, loading: sessionLoading } = useSession()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)

  if (!sessionLoading && session) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    setSubmitting(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (data.session) {
      navigate('/onboarding')
    } else {
      // Email confirmation is required before a session exists.
      setNeedsEmailConfirmation(true)
    }
  }

  if (needsEmailConfirmation) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center flex flex-col gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Check your email</h1>
          <p className="text-slate-600">
            We sent a confirmation link to <span className="font-medium">{email}</span>. Confirm
            it, then come back and log in.
          </p>
          <Link to="/login" className="text-indigo-600 font-medium">
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col gap-4"
      >
        <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 text-white font-medium py-2 disabled:opacity-50"
        >
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>

        <p className="text-sm text-slate-600 text-center">
          Already have an account? <Link to="/login" className="text-indigo-600 font-medium">Log in</Link>
        </p>
      </form>
    </div>
  )
}
