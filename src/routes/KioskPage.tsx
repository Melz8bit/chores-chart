import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { supabase } from '../lib/supabase'
import { useKioskBoard, type KioskBoardRow } from '../hooks/useKioskBoard'
import { useCompleteChore } from '../hooks/useCompleteChore'
import { useUncompleteChore } from '../hooks/useUncompleteChore'
import { useCurrentFamilyMember } from '../hooks/useCurrentFamilyMember'
import { useFullscreen } from '../hooks/useFullscreen'
import { KidAvatar } from '../components/KidAvatar'
import { Emoji } from '../components/Emoji'
import { RedemptionModal } from '../components/RedemptionModal'
import { RedemptionHistory } from '../components/RedemptionHistory'

interface KidBoard {
  id: string
  name: string
  emoji: string | null
  color: string | null
  pointsBalance: number
  chores: KioskBoardRow[]
}

function groupByKid(rows: KioskBoardRow[]): KidBoard[] {
  const kids = new Map<string, KidBoard>()
  for (const row of rows) {
    if (!kids.has(row.member_id)) {
      kids.set(row.member_id, {
        id: row.member_id,
        name: row.member_name,
        emoji: row.member_emoji,
        color: row.member_color,
        pointsBalance: row.points_balance,
        chores: [],
      })
    }
    kids.get(row.member_id)!.chores.push(row)
  }
  return Array.from(kids.values())
}

function fireConfetti(target: HTMLElement) {
  const rect = target.getBoundingClientRect()
  confetti({
    particleCount: 70,
    spread: 65,
    startVelocity: 35,
    origin: {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    },
  })
}

export function KioskPage() {
  const { data: rows = [], isLoading } = useKioskBoard()
  const { familyMember } = useCurrentFamilyMember()
  const { isFullscreen, supported: fullscreenSupported, toggle: toggleFullscreen } = useFullscreen()
  const completeChore = useCompleteChore()
  const uncompleteChore = useUncompleteChore()
  const [pendingChoreId, setPendingChoreId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRedeemModal, setShowRedeemModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const kids = groupByKid(rows)

  function showError(err: unknown) {
    const message =
      err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'Something went wrong'

    const friendlyMessage = message.toLowerCase().includes('already been redeemed')
      ? "Can't undo that one — those points were already spent on a reward, so they can't be taken back. 🌟"
      : message

    setError(friendlyMessage)
    setTimeout(() => setError(null), 4000)
  }

  async function handleComplete(chore: KioskBoardRow, memberId: string, buttonEl: HTMLButtonElement) {
    setPendingChoreId(chore.chore_id)
    try {
      await completeChore.mutateAsync({ choreId: chore.chore_id, memberId })
      fireConfetti(buttonEl)
    } catch (err) {
      showError(err)
    } finally {
      setPendingChoreId(null)
    }
  }

  async function handleUndo(chore: KioskBoardRow, memberId: string) {
    setPendingChoreId(chore.chore_id)
    try {
      await uncompleteChore.mutateAsync({ choreId: chore.chore_id, memberId })
    } catch (err) {
      showError(err)
    } finally {
      setPendingChoreId(null)
    }
  }

  return (
    <div className="h-svh w-full flex flex-col bg-slate-50">
      <header className="shrink-0 flex items-center justify-between px-4 sm:px-8 py-3 bg-white border-b border-slate-200">
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Chores</h1>
        <div className="flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => setShowRedeemModal(true)}
            disabled={kids.length === 0}
            className="rounded-lg bg-indigo-600 text-white font-medium px-3 py-1.5 disabled:opacity-50"
          >
            Redeem points
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            disabled={!familyMember}
            className="text-indigo-600 font-medium disabled:opacity-50"
          >
            History
          </button>
          <Link to="/dashboard" className="text-indigo-600 font-medium">
            Dashboard
          </Link>
          <Link to="/settings" className="text-indigo-600 font-medium">
            Settings
          </Link>
          {fullscreenSupported && (
            <button type="button" onClick={toggleFullscreen} className="text-slate-500 font-medium">
              {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </button>
          )}
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="text-slate-500 font-medium"
          >
            Log out
          </button>
        </div>
      </header>

      {error && (
        <div className="shrink-0 bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <main className="flex-1 min-h-0">
        {isLoading ? (
          <p className="p-6 text-slate-500">Loading…</p>
        ) : kids.length === 0 ? (
          <p className="p-6 text-slate-500">
            No kids yet — add one in{' '}
            <Link to="/settings/members" className="text-indigo-600 font-medium">
              Settings
            </Link>
            .
          </p>
        ) : (
          <div
            className="h-full w-full grid grid-cols-1 grid-rows-[repeat(var(--kid-count),1fr)] sm:grid-rows-1 sm:grid-cols-[repeat(var(--kid-count),1fr)]"
            style={{ '--kid-count': kids.length } as CSSProperties}
          >
            {kids.map((kid) => (
              <section
                key={kid.id}
                className="flex flex-col gap-4 p-4 sm:p-6 overflow-y-auto border-b sm:border-b-0 sm:border-r border-slate-200 last:border-b-0 sm:last:border-r-0"
                style={{ backgroundColor: kid.color ? `${kid.color}26` : 'white' }}
              >
                <div className="flex items-center gap-3 shrink-0">
                  <KidAvatar emoji={kid.emoji} color={kid.color} size="lg" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{kid.name}</h2>
                    <p className="text-sm font-medium text-indigo-600">{kid.pointsBalance} points</p>
                  </div>
                </div>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] content-start gap-3">
                  {kid.chores.map((chore) => {
                    const done = chore.remaining <= 0
                    const pending = pendingChoreId === chore.chore_id
                    return (
                      <div key={chore.chore_id} className="relative">
                        <button
                          type="button"
                          disabled={done || pending}
                          onClick={(e) => handleComplete(chore, kid.id, e.currentTarget)}
                          className={`w-full flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition ${
                            done
                              ? 'border-slate-200 bg-slate-100 opacity-50'
                              : 'border-slate-200 bg-white hover:border-indigo-400 active:scale-95'
                          }`}
                        >
                          <Emoji emoji={chore.chore_emoji} fallback="⭐" className="h-8 w-8" />
                          <span className="text-sm font-medium text-slate-800">{chore.chore_name}</span>
                          <span className="text-xs text-slate-500">
                            {chore.chore_points} pts
                            {chore.times_per_period > 1 &&
                              ` · ${chore.completed_count}/${chore.times_per_period}`}
                          </span>
                        </button>

                        {chore.completed_count > 0 && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleUndo(chore, kid.id)}
                            aria-label={`Undo last completion of ${chore.chore_name}`}
                            className="absolute -top-2.5 -right-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                          >
                            ↺
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {kid.chores.length === 0 && (
                    <p className="col-span-full text-sm text-slate-400">No chores right now.</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {showRedeemModal && (
        <RedemptionModal
          kids={kids.map((k) => ({ id: k.id, name: k.name, pointsBalance: k.pointsBalance }))}
          onClose={() => setShowRedeemModal(false)}
        />
      )}

      {showHistory && familyMember && (
        <RedemptionHistory familyId={familyMember.family_id} onClose={() => setShowHistory(false)} />
      )}
    </div>
  )
}
