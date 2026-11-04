import { useState, type FormEvent } from 'react'
import type { PointsMode } from '../../lib/database.types'
import { useCurrentFamilyMember } from '../../hooks/useCurrentFamilyMember'
import { useFamily, useRenameFamily, useSetDailyReportHour } from '../../hooks/useFamily'
import { useHasSettingsPin, useSetSettingsPin } from '../../hooks/useSettingsPin'
import { useSetPointsMode, useSetRolloverHour } from '../../hooks/usePointsDay'
import { ROLLOVER_HOURS, formatRolloverHour } from '../../lib/schoolPoints'
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

// The family name doubles as the kiosk board's title, so it's editable here.
function FamilyName({ familyId, name }: { familyId: string; name: string }) {
  const renameFamily = useRenameFamily(familyId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    if (trimmed !== name) {
      try {
        await renameFamily.mutateAsync(trimmed)
      } catch {
        return // error shown below the input via renameFamily.isError
      }
    }
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-lg font-semibold text-slate-900">{name}</h2>
        <button
          type="button"
          onClick={() => {
            setDraft(name)
            renameFamily.reset()
            setEditing(true)
          }}
          className="text-sm font-medium text-indigo-600"
        >
          Rename
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-2">
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Family name (shown as the board's title)
        <input
          autoFocus
          required
          maxLength={40}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>
      {renameFamily.isError && <p className="text-sm text-red-600">{renameFamily.error.message}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={renameFamily.isPending}
          className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-3 py-1.5 disabled:opacity-50"
        >
          {renameFamily.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-sm font-medium text-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// noon through 11pm, matching the families.daily_report_hour check (0029).
const DAILY_REPORT_HOURS = Array.from({ length: 12 }, (_, i) => 12 + i)

const POINTS_MODES:{ value: PointsMode; label: string; description: (rolloverHour: number) => string }[] = [
  {
    value: 'vacation',
    label: '☀️ Vacation',
    description: () => 'Every day earns full points.',
  },
  {
    value: 'school',
    label: '🎒 School',
    description: (rolloverHour) =>
      rolloverHour === 0
        ? 'School days earn ⅓ of the points (rounded up). Weekends and holidays earn full points. Days switch at midnight.'
        : `School days earn ⅓ of the points (rounded up). Weekends and holidays earn full points. Days switch at ${formatRolloverHour(rolloverHour)}, so Friday night counts as the weekend and Sunday night as a school day.`,
  },
]

export function FamilyPage() {
  const { familyMember } = useCurrentFamilyMember()
  const familyId = familyMember?.family_id
  const [copied, setCopied] = useState(false)
  const [showSetPin, setShowSetPin] = useState(false)

  const { data: family, isLoading } = useFamily(familyId)

  const { data: hasPin } = useHasSettingsPin(familyId)
  const setPin = useSetSettingsPin(familyId)
  const setPointsMode = useSetPointsMode(familyId)
  const setRolloverHour = useSetRolloverHour(familyId)
  const setDailyReportHour = useSetDailyReportHour(familyId)

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
        <FamilyName familyId={family.id} name={family.name} />
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
        <h3 className="text-sm font-medium text-slate-700 mb-2">Points mode</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {POINTS_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              disabled={setPointsMode.isPending}
              onClick={() => setPointsMode.mutate(mode.value)}
              aria-pressed={family.points_mode === mode.value}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                family.points_mode === mode.value
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-slate-300 text-slate-600'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500">
          {POINTS_MODES.find((mode) => mode.value === family.points_mode)?.description(family.rollover_hour)}
        </p>
        {family.points_mode === 'school' && (
          <label className="flex items-center gap-2 mt-3 text-sm text-slate-700">
            New day starts at
            <select
              value={family.rollover_hour}
              disabled={setRolloverHour.isPending}
              onChange={(e) => setRolloverHour.mutate(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              {ROLLOVER_HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {formatRolloverHour(hour)}
                </option>
              ))}
            </select>
          </label>
        )}
        {setPointsMode.isError && (
          <p className="text-sm text-red-600 mt-2">{setPointsMode.error.message}</p>
        )}
        {setRolloverHour.isError && (
          <p className="text-sm text-red-600 mt-2">{setRolloverHour.error.message}</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-medium text-slate-700 mb-2">Daily report</h3>
        <p className="text-sm text-slate-500 mb-3">
          Parents who turn on the daily report in Settings &gt; Account get a summary of each kid's day
          at this time.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          Send at
          <select
            value={family.daily_report_hour}
            disabled={setDailyReportHour.isPending}
            onChange={(e) => setDailyReportHour.mutate(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            {DAILY_REPORT_HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {formatRolloverHour(hour)}
              </option>
            ))}
          </select>
        </label>
        {setDailyReportHour.isError && (
          <p className="text-sm text-red-600 mt-2">{setDailyReportHour.error.message}</p>
        )}
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
