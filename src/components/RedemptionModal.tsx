import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { useRequestRedemption } from '../hooks/useRedemptionRequests'

interface KidOption {
  id: string
  name: string
  // Balance minus points already waiting on a parent's approval.
  available: number
}

export function RedemptionModal({ kids, onClose }: { kids: KidOption[]; onClose: () => void }) {
  const requestRedemption = useRequestRedemption()
  const [memberId, setMemberId] = useState(kids[0]?.id ?? '')
  const [amount, setAmount] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const selectedKid = kids.find((k) => k.id === memberId)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!selectedKid) {
      setError('Choose a kid.')
      return
    }
    if (!amount || amount <= 0) {
      setError('Enter an amount greater than 0.')
      return
    }
    const notEnough = `Not enough points yet! ${selectedKid.name} has ${selectedKid.available} points to spend — keep doing chores to earn more. 🌟`
    if (amount > selectedKid.available) {
      setError(notEnough)
      return
    }

    try {
      await requestRedemption.mutateAsync({ memberId, amount })
      setSent(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.toLowerCase().includes('insufficient points')) {
        setError(notEnough)
      } else {
        setError(message || 'Something went wrong')
      }
    }
  }

  if (sent && selectedKid) {
    return (
      <Modal title="Request sent" onClose={onClose}>
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-4xl">⏳</p>
          <p className="text-slate-700">
            {selectedKid.name}'s request for {amount} points is waiting for a parent to approve it.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-indigo-600 text-white font-medium px-4 py-2"
          >
            OK
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Redeem points" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Kid
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
          >
            {kids.map((kid) => (
              <option key={kid.id} value={kid.id}>
                {kid.name} — {kid.available} pts
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Points to redeem
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-slate-600 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={requestRedemption.isPending || kids.length === 0}
            className="rounded-lg bg-indigo-600 text-white font-medium px-4 py-2 disabled:opacity-50"
          >
            {requestRedemption.isPending ? 'Sending…' : 'Ask a parent'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
