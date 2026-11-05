import { useState } from 'react'
import { PinKeypad } from './PinKeypad'

// Approve / Deny for one pending request (points redemption or a chore that
// needs approval). With this device's approval key (a registered parent
// phone) or no family PIN set, the buttons act immediately; otherwise (the
// kiosk tablet) they ask for the Settings PIN. The server checks either way.
export function ApprovalDecision({
  subject,
  requirePin,
  deviceKey,
  busy,
  decide,
  onDecided,
}: {
  // Finishes "Enter the parent PIN to approve …", e.g. "20 points for Lucas".
  subject: string
  requirePin: boolean
  deviceKey: string | null
  busy: boolean
  decide: (approve: boolean, pin: string | null) => Promise<void>
  onDecided?: (approved: boolean) => void
}) {
  const [pinFor, setPinFor] = useState<'approve' | 'deny' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(approve: boolean, pin: string | null) {
    setError(null)
    try {
      await decide(approve, pin)
      setPinFor(null)
      onDecided?.(approve)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setError(message.includes('Incorrect PIN') ? 'Incorrect PIN, try again.' : message || 'Something went wrong')
    }
  }

  function choose(approve: boolean) {
    if (requirePin && !deviceKey) {
      setError(null)
      setPinFor(approve ? 'approve' : 'deny')
    } else {
      submit(approve, null)
    }
  }

  if (pinFor) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-slate-500">
          Enter the parent PIN to {pinFor} {subject}
        </p>
        <PinKeypad onComplete={(pin) => submit(pinFor === 'approve', pin)} error={error} />
        <button type="button" onClick={() => setPinFor(null)} className="text-sm font-medium text-slate-500">
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => choose(true)}
          className="flex-1 rounded-lg bg-green-600 text-white font-medium px-4 py-2.5 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => choose(false)}
          className="flex-1 rounded-lg border border-slate-300 text-slate-700 font-medium px-4 py-2.5 disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    </div>
  )
}
