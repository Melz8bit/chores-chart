import { Modal } from './Modal'
import { KidAvatar } from './KidAvatar'
import { useRedemptionHistory } from '../hooks/useRedemptionHistory'

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function RedemptionHistory({ familyId, onClose }: { familyId: string; onClose: () => void }) {
  const { data: entries = [], isLoading } = useRedemptionHistory(familyId)

  return (
    <Modal title="Redemption history" onClose={onClose}>
      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-slate-500">No points redeemed yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 border-b border-slate-100 last:border-b-0"
            >
              <span className="flex items-center gap-2 min-w-0">
                <KidAvatar emoji={entry.member_emoji} color={entry.member_color} size="sm" />
                <span className="text-slate-800 font-medium truncate">{entry.member_name}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0 text-sm">
                <span className="font-semibold text-red-600">{entry.amount} pts</span>
                <span className="text-slate-400">{formatRelativeTime(entry.created_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
