import { useDecideRedemption, type RedemptionRequestDetails } from '../hooks/useRedemptionRequests'
import { ApprovalDecision } from './ApprovalDecision'

export function RedemptionDecision({
  request,
  requirePin,
  deviceKey,
  onDecided,
}: {
  request: RedemptionRequestDetails
  requirePin: boolean
  deviceKey: string | null
  onDecided?: (approved: boolean) => void
}) {
  const decide = useDecideRedemption()
  return (
    <ApprovalDecision
      subject={`${request.amount} points for ${request.kid_name}`}
      requirePin={requirePin}
      deviceKey={deviceKey}
      busy={decide.isPending}
      decide={(approve, pin) => decide.mutateAsync({ requestId: request.id, approve, pin, deviceKey })}
      onDecided={onDecided}
    />
  )
}
