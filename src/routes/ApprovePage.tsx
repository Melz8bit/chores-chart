import { Link, useParams } from 'react-router-dom'
import { useCurrentFamilyMember } from '../hooks/useCurrentFamilyMember'
import { useHasSettingsPin } from '../hooks/useSettingsPin'
import { useRedemptionRequest } from '../hooks/useRedemptionRequests'
import { getApprovalKey } from '../hooks/usePushNotifications'
import { KidAvatar } from '../components/KidAvatar'
import { RedemptionDecision } from '../components/RedemptionDecision'

// Opened from a "wants to redeem points" notification on a parent's phone.
export function ApprovePage() {
  const { requestId } = useParams()
  const { familyMember } = useCurrentFamilyMember()
  const { data: hasPin } = useHasSettingsPin(familyMember?.family_id)
  const { data: request, isLoading } = useRedemptionRequest(requestId)

  const time = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })

  return (
    <div className="min-h-svh bg-slate-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 flex flex-col gap-5">
        {isLoading ? (
          <p className="text-slate-500">Loading…</p>
        ) : !request ? (
          <p className="text-slate-600">This request doesn't exist anymore.</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <KidAvatar emoji={request.kid_emoji} color={request.kid_color} size="lg" />
              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  {request.kid_name} wants {request.amount} points
                </h1>
                <p className="text-sm text-slate-500">
                  Asked {time(request.requested_at)} · balance {request.kid_balance} points
                </p>
              </div>
            </div>

            {request.status === 'pending' ? (
              <RedemptionDecision request={request} requirePin={!!hasPin} deviceKey={getApprovalKey()} />
            ) : (
              <p
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  request.status === 'approved' ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {request.status === 'approved' ? '✅ Approved' : '✖️ Denied'}
                {request.decided_by_name && ` by ${request.decided_by_name}`}
                {request.decided_at && ` · ${time(request.decided_at)}`}
              </p>
            )}
          </>
        )}
      </div>
      <Link to="/dashboard" className="mt-6 text-sm font-medium text-indigo-600">
        Go to the dashboard
      </Link>
    </div>
  )
}
