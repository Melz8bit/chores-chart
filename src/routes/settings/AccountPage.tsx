import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../hooks/useSession'
import { useCurrentFamilyMember } from '../../hooks/useCurrentFamilyMember'
import { useFamily, useSetDailyReportOptIn } from '../../hooks/useFamily'
import { formatRolloverHour } from '../../lib/schoolPoints'
import type { FamilyMember } from '../../lib/database.types'
import {
  pushConfigured,
  pushSupported,
  useEnablePush,
  useRegisteredDevices,
  useRemoveDevice,
  useSendTestPush,
  useThisDeviceEndpoint,
} from '../../hooks/usePushNotifications'

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

function NotificationsCard({ familyId }: { familyId: string }) {
  const { data: thisEndpoint } = useThisDeviceEndpoint()
  const { data: devices, isLoading } = useRegisteredDevices(familyId)
  const enablePush = useEnablePush()
  const removeDevice = useRemoveDevice()
  const sendTest = useSendTestPush()

  const thisDevice = devices?.find((device) => device.endpoint === thisEndpoint)
  const error = enablePush.error ?? removeDevice.error ?? sendTest.error

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-slate-700">Notifications</h3>
        <p className="text-sm text-slate-500">
          Notifications go to devices, not accounts. Turn them on for each parent phone that should get
          them.
        </p>
      </div>

      {!pushSupported ? (
        <p className="text-sm text-amber-700">
          This browser can't receive notifications. Open {window.location.host} in Chrome, Samsung
          Internet, or Firefox (not from inside another app) and turn them on there.
        </p>
      ) : !pushConfigured ? (
        <p className="text-sm text-amber-700">Notifications aren't set up for this app yet.</p>
      ) : thisDevice ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-green-700">This device gets notifications.</p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              disabled={sendTest.isPending}
              onClick={() => sendTest.mutate(thisDevice.endpoint)}
              className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-3 py-1.5 disabled:opacity-50"
            >
              {sendTest.isPending ? 'Sending…' : 'Send test notification'}
            </button>
            <button
              type="button"
              disabled={removeDevice.isPending}
              onClick={() => removeDevice.mutate(thisDevice)}
              className="text-sm font-medium text-slate-400 hover:text-red-600"
            >
              Turn off for this device
            </button>
          </div>
          {sendTest.isSuccess && <p className="text-sm text-slate-500">Sent. It should appear in a few seconds.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-amber-700">
            Don't turn this on for the shared kiosk tablet. Kids would see notifications and approval
            requests meant for parents.
          </p>
          <button
            type="button"
            disabled={enablePush.isPending}
            onClick={() => enablePush.mutate()}
            className="self-start rounded-lg bg-indigo-600 text-white text-sm font-medium px-3 py-1.5 disabled:opacity-50"
          >
            {enablePush.isPending ? 'Turning on…' : 'Turn on notifications for this device'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="border-t border-slate-100 pt-3">
        <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Registered devices</h4>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !devices || devices.length === 0 ? (
          <p className="text-sm text-slate-500">No devices yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">
                  {device.device_label}
                  <span className="text-slate-400"> · {device.owner_name}</span>
                  {device.endpoint === thisEndpoint && (
                    <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      This device
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={removeDevice.isPending}
                  onClick={() => {
                    if (confirm(`Stop sending notifications to ${device.device_label}?`)) {
                      removeDevice.mutate(device)
                    }
                  }}
                  className="text-sm font-medium text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function DailyReportCard({ member }: { member: FamilyMember }) {
  const { data: family } = useFamily(member.family_id)
  const { data: devices } = useRegisteredDevices(member.family_id)
  const setOptIn = useSetDailyReportOptIn()

  const myDeviceCount = devices?.filter((device) => device.family_member_id === member.id).length ?? 0
  const reportTime = family ? formatRolloverHour(family.daily_report_hour) : '…'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-2">
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={member.daily_report}
          disabled={setOptIn.isPending}
          onChange={(e) => setOptIn.mutate(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-indigo-600"
        />
        <span>
          Send me a daily report at {reportTime}
          <span className="block text-xs text-slate-500">
            Each kid's chores done and still to do, plus points earned and spent today. The time is set
            for the whole family in Settings &gt; Family.
          </span>
        </span>
      </label>
      {member.daily_report && devices && (
        <p className={`text-sm ${myDeviceCount === 0 ? 'text-amber-700' : 'text-slate-500'}`}>
          {myDeviceCount === 0
            ? "You don't have any devices with notifications on yet, so the report has nowhere to go. Turn them on above from your phone."
            : `Goes to your ${myDeviceCount === 1 ? 'registered device' : `${myDeviceCount} registered devices`}.`}
        </p>
      )}
      {setOptIn.isError && <p className="text-sm text-red-600">{setOptIn.error.message}</p>}
    </div>
  )
}

export function AccountPage() {
  const { session, loading } = useSession()
  const { familyMember } = useCurrentFamilyMember()
  const email = session?.user.email

  if (loading || !email) {
    return <p className="text-slate-500">Loading…</p>
  }

  return (
    <div className="max-w-md flex flex-col gap-6">
      <p className="text-sm text-slate-500">
        These settings are for the parent account this device is logged in as.
      </p>
      {familyMember && <NotificationsCard familyId={familyMember.family_id} />}
      {familyMember && pushConfigured && <DailyReportCard member={familyMember} />}
      <ChangeEmailForm currentEmail={email} />
      <ChangePasswordForm currentEmail={email} />
    </div>
  )
}
