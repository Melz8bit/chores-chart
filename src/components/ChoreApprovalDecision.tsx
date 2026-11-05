import { useDecideChoreApproval, type ChoreApprovalDetails } from '../hooks/useChoreApprovals'
import { ApprovalDecision } from './ApprovalDecision'

export function ChoreApprovalDecision({
  request,
  requirePin,
  deviceKey,
  onDecided,
}: {
  request: ChoreApprovalDetails
  requirePin: boolean
  deviceKey: string | null
  onDecided?: (approved: boolean) => void
}) {
  const decide = useDecideChoreApproval()
  return (
    <ApprovalDecision
      subject={`${request.chore_name} for ${request.kid_name}`}
      requirePin={requirePin}
      deviceKey={deviceKey}
      busy={decide.isPending}
      decide={(approve, pin) => decide.mutateAsync({ requestId: request.id, approve, pin, deviceKey })}
      onDecided={onDecided}
    />
  )
}
