import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Family } from '../../lib/database.types'
import { useCurrentFamilyMember } from '../../hooks/useCurrentFamilyMember'
import { useHasSettingsPin, useSetSettingsPin } from '../../hooks/useSettingsPin'
import { Modal } from '../../components/Modal'
import { PinKeypad } from '../../components/PinKeypad'

function SetPinModal({ familyId, onClose }: { familyId: string; onClose: () => void }) {
  const setPin = useSetSettingsPin(familyId)
  const [step, setStep] = useState<'enter' | 'confirm'>('enter')
  const [firstPin, setFirstPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleFirstComplete(pin: string) {
    setFirstPin(pin)
    setStep('confirm')
    setError(null)
  }

  async function handleConfirmComplete(pin: string) {
    if (pin !== firstPin) {
      setError("PINs didn't match — try again.")
      setStep('enter')
      setFirstPin('')
      return
    }
    try {
      await setPin.mutateAsync(pin)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('enter')
      setFirstPin('')
    }
  }

  return (
    <Modal title={step === 'enter' ? 'Set a new PIN' : 'Confirm PIN'} onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-slate-500">
          {step === 'enter' ? 'Enter a 4-digit PIN' : 'Enter it again to confirm'}
        </p>
        {step === 'enter' ? (
          <PinKeypad key="enter" onComplete={handleFirstComplete} error={error} />
        ) : (
          <PinKeypad key="confirm" onComplete={handleConfirmComplete} error={error} />
        )}
      </div>
    </Modal>
  )
}

export function FamilyPage() {
  const { familyMember } = useCurrentFamilyMember()
  const familyId = familyMember?.family_id
  const [copied, setCopied] = useState(false)
  const [showSetPin, setShowSetPin] = useState(false)

  const { data: family, isLoading } = useQuery({
    queryKey: ['family', familyId],
    queryFn: async (): Promise<Family> => {
      const { data, error } = await supabase
        .from('families')
        .select('id, name, timezone, week_start_day, invite_code, last_expired_date, created_at')
        .eq('id', familyId as string)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!familyId,
  })

  const { data: hasPin } = useHasSettingsPin(familyId)
  const setPin = useSetSettingsPin(familyId)

  if (isLoading || !family) {
    return <p className="text-slate-500">Loading…</p>
  }

  async function copyCode() {
    await navigator.clipboard.writeText(family!.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="max-w-md flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">{family.name}</h2>
        <p className="text-sm text-slate-500">Timezone: {family.timezone}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600 mb-2">
          Share this code with the other parent so they can join your family:
        </p>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-mono font-semibold tracking-widest text-slate-900">
            {family.invite_code}
          </span>
          <button
            type="button"
            onClick={copyCode}
            className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-3 py-1.5"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-medium text-slate-700 mb-2">Parent PIN</h3>
        <p className="text-sm text-slate-500 mb-3">
          {hasPin
            ? 'A PIN is required to enter Settings.'
            : 'No PIN set — Settings is open to anyone right now.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSetPin(true)}
            className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-3 py-1.5"
          >
            {hasPin ? 'Change PIN' : 'Set a PIN'}
          </button>
          {hasPin && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Remove the parent PIN? Settings will be open to anyone again.')) {
                  setPin.mutate(null)
                }
              }}
              className="text-sm font-medium text-slate-400 hover:text-red-600"
            >
              Remove PIN
            </button>
          )}
        </div>
      </div>

      {showSetPin && familyId && (
        <SetPinModal familyId={familyId} onClose={() => setShowSetPin(false)} />
      )}
    </div>
  )
}
