import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import confetti from 'canvas-confetti'
import { supabase } from '../lib/supabase'
import { useKioskBoard, type KioskBoardRow } from '../hooks/useKioskBoard'
import { useCompleteChore } from '../hooks/useCompleteChore'
import { useUncompleteChore } from '../hooks/useUncompleteChore'
import { useCurrentFamilyMember } from '../hooks/useCurrentFamilyMember'
import { useFullscreen } from '../hooks/useFullscreen'
import { usePointsDay, useSetHoliday } from '../hooks/usePointsDay'
import { useFamily } from '../hooks/useFamily'
import { useHasSettingsPin } from '../hooks/useSettingsPin'
import { usePendingRedemptions } from '../hooks/useRedemptionRequests'
import { getApprovalKey } from '../hooks/usePushNotifications'
import type { PointsDayKind } from '../lib/database.types'
import { formatRolloverHour } from '../lib/schoolPoints'
import { KidAvatar } from '../components/KidAvatar'
import { Emoji } from '../components/Emoji'
import { RedemptionModal } from '../components/RedemptionModal'
import { RedemptionHistory } from '../components/RedemptionHistory'
import { Modal } from '../components/Modal'
import { PinKeypad } from '../components/PinKeypad'
import { RedemptionDecision } from '../components/RedemptionDecision'
import { usePendingChoreApprovals, useRequestChoreApproval } from '../hooks/useChoreApprovals'
import { ChoreApprovalDecision } from '../components/ChoreApprovalDecision'

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

interface CategoryBoard {
  id: string | null
  name: string
  chores: KioskBoardRow[]
}

function groupByCategory(rows: KioskBoardRow[]): CategoryBoard[] {
  const categories = new Map<string, CategoryBoard>()
  for (const row of rows) {
    const key = row.category_id ?? 'uncategorized'
    if (!categories.has(key)) {
      categories.set(key, {
        id: row.category_id,
        name: row.category_name ?? 'Uncategorized',
        chores: [],
      })
    }
    categories.get(key)!.chores.push(row)
  }
  return Array.from(categories.values())
}

const DAY_BADGES: Record<PointsDayKind, { label: string; className: string }> = {
  school_day: { label: '🎒 School day · ⅓ points', className: 'bg-amber-100 text-amber-800' },
  weekend: { label: '🎉 Weekend · full points', className: 'bg-emerald-100 text-emerald-800' },
  holiday: { label: '🎈 Holiday · full points', className: 'bg-emerald-100 text-emerald-800' },
  vacation: { label: '☀️ Vacation · full points', className: 'bg-sky-100 text-sky-800' },
}

// Parent confirmation for the holiday checkbox: PIN keypad when a Settings
// PIN is set, a plain confirm otherwise. The PIN is checked server-side by
// set_holiday, not here.
function HolidayModal({
  turningOn,
  requirePin,
  rolloverHour,
  onClose,
}: {
  turningOn: boolean
  requirePin: boolean
  rolloverHour: number
  onClose: () => void
}) {
  const setHoliday = useSetHoliday()
  const [error, setError] = useState<string | null>(null)

  async function submit(pin: string | null) {
    setError(null)
    try {
      await setHoliday.mutateAsync({ on: turningOn, pin })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setError(message.includes('Incorrect PIN') ? 'Incorrect PIN, try again.' : message || 'Something went wrong')
    }
  }

  return (
    <Modal title={turningOn ? 'Mark today as a holiday?' : 'Turn off holiday?'} onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-slate-500 text-center">
          {turningOn
            ? `Chores earn full points until the holiday ends at ${formatRolloverHour(rolloverHour)}.`
            : 'Chores go back to school-day points (⅓).'}
        </p>
        {requirePin ? (
          <PinKeypad onComplete={submit} error={error} />
        ) : (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              disabled={setHoliday.isPending}
              onClick={() => submit(null)}
              className="rounded-lg bg-indigo-600 text-white font-medium px-4 py-2 disabled:opacity-50"
            >
              {turningOn ? 'Mark as holiday' : 'Turn off holiday'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
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
  const requestChoreApproval = useRequestChoreApproval()
  const [pendingChoreId, setPendingChoreId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRedeemModal, setShowRedeemModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showHolidayModal, setShowHolidayModal] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null)
  const [reviewingChoreRequestId, setReviewingChoreRequestId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the mobile nav menu on outside tap or Escape.
  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])
  const { data: pointsDay } = usePointsDay()
  const { data: family } = useFamily(familyMember?.family_id)
  const { data: hasPin } = useHasSettingsPin(familyMember?.family_id)
  const { data: pendingRedemptions = [] } = usePendingRedemptions(familyMember?.family_id)
  const reviewingRequest = pendingRedemptions.find((r) => r.id === reviewingRequestId)
  const { data: pendingChoreApprovals = [] } = usePendingChoreApprovals(familyMember?.family_id)
  const reviewingChoreRequest = pendingChoreApprovals.find((r) => r.id === reviewingChoreRequestId)

  // A request approved from a parent's phone changes the kid's balance (and
  // the chore's state); refresh the board as soon as a pending list changes.
  const queryClient = useQueryClient()
  const pendingKey = [...pendingRedemptions, ...pendingChoreApprovals].map((r) => r.id).join(',')
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['kioskBoard'] })
  }, [pendingKey, queryClient])

  const isHoliday = pointsDay?.day_kind === 'holiday'
  // Only meaningful on a school day in school mode (or to undo a holiday).
  const showHolidayToggle =
    pointsDay?.points_mode === 'school' && (pointsDay.day_kind === 'school_day' || isHoliday)

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
      if (chore.requires_approval) {
        // No points (or confetti) yet: this asks a parent.
        await requestChoreApproval.mutateAsync({ choreId: chore.chore_id, memberId })
        return
      }
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

  function renderNavItems(inMenu: boolean) {
    const item = inMenu ? 'block w-full text-left px-4 py-2.5 hover:bg-slate-50' : 'whitespace-nowrap'
    const close = () => setMenuOpen(false)
    return (
      <>
        <button
          type="button"
          onClick={() => {
            close()
            setShowHistory(true)
          }}
          disabled={!familyMember}
          className={`${item} text-indigo-600 font-medium disabled:opacity-50`}
        >
          History
        </button>
        <Link to="/dashboard" onClick={close} className={`${item} text-indigo-600 font-medium`}>
          Dashboard
        </Link>
        <Link to="/settings" onClick={close} className={`${item} text-indigo-600 font-medium`}>
          Settings
        </Link>
        {fullscreenSupported && (
          <button
            type="button"
            onClick={() => {
              close()
              toggleFullscreen()
            }}
            className={`${item} text-slate-500 font-medium`}
          >
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            close()
            supabase.auth.signOut()
          }}
          className={`${item} text-slate-500 font-medium`}
        >
          Log out
        </button>
      </>
    )
  }

  return (
    <div className="h-svh w-full flex flex-col bg-slate-50">
      <header className="relative z-10 shrink-0 flex items-center justify-between gap-3 px-4 sm:px-8 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900">{family?.name ?? ' '}</h1>
          {pointsDay && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DAY_BADGES[pointsDay.day_kind].className}`}
            >
              {DAY_BADGES[pointsDay.day_kind].label}
            </span>
          )}
          {showHolidayToggle && (
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={isHoliday}
                onChange={(e) => {
                  e.preventDefault()
                  setShowHolidayModal(true)
                }}
                className="h-4 w-4 accent-indigo-600"
              />
              Holiday
            </label>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => setShowRedeemModal(true)}
            disabled={kids.length === 0}
            className="rounded-lg bg-indigo-600 text-white font-medium px-3 py-1.5 whitespace-nowrap disabled:opacity-50"
          >
            Redeem points
          </button>

          {/* Desktop/tablet: secondary nav inline */}
          <nav className="hidden md:flex items-center gap-4">{renderNavItems(false)}</nav>

          {/* Mobile: secondary nav collapsed behind a menu button */}
          <div ref={menuRef} className="relative md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="kiosk-nav-menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
            {menuOpen && (
              <nav
                id="kiosk-nav-menu"
                className="absolute right-0 top-full mt-2 z-20 w-48 flex flex-col rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              >
                {renderNavItems(true)}
              </nav>
            )}
          </div>
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

                {pendingRedemptions
                  .filter((request) => request.family_member_id === kid.id)
                  .map((request) => (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => setReviewingRequestId(request.id)}
                      className="shrink-0 self-start rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800"
                    >
                      ⏳ {request.amount} points waiting for a parent
                    </button>
                  ))}

                <div className="flex flex-col gap-4">
                  {groupByCategory(kid.chores).map((category) => (
                    <div key={category.id ?? 'uncategorized'}>
                      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                        {category.name}
                      </h3>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] content-start gap-3">
                        {category.chores.map((chore) => {
                          // Requests waiting for a parent take up their rep, so
                          // a kid can't ask twice for the same one.
                          const done = chore.remaining - chore.pending_count <= 0
                          const pending = pendingChoreId === chore.chore_id
                          const waitingRequest = pendingChoreApprovals.find(
                            (r) => r.chore_id === chore.chore_id && r.family_member_id === kid.id,
                          )
                          return (
                            <div key={chore.chore_id} className="relative flex flex-col gap-1.5">
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
                                <span className="text-sm font-medium text-slate-800">
                                  {chore.chore_name}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {chore.chore_points} pts
                                  {chore.times_per_period > 1 &&
                                    ` · ${chore.completed_count}/${chore.times_per_period}`}
                                </span>
                                {chore.requires_approval && (
                                  <span className="text-xs text-amber-700">Parent approves</span>
                                )}
                              </button>

                              {waitingRequest && (
                                <button
                                  type="button"
                                  onClick={() => setReviewingChoreRequestId(waitingRequest.id)}
                                  className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
                                >
                                  ⏳ Waiting for a parent
                                </button>
                              )}

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
                      </div>
                    </div>
                  ))}
                  {kid.chores.length === 0 && (
                    <p className="text-sm text-slate-400">No chores right now.</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {showRedeemModal && (
        <RedemptionModal
          kids={kids.map((k) => ({
            id: k.id,
            name: k.name,
            available:
              k.pointsBalance -
              pendingRedemptions
                .filter((r) => r.family_member_id === k.id)
                .reduce((sum, r) => sum + r.amount, 0),
          }))}
          onClose={() => setShowRedeemModal(false)}
        />
      )}

      {reviewingRequest && (
        <Modal
          title={`${reviewingRequest.kid_name} wants ${reviewingRequest.amount} points`}
          onClose={() => setReviewingRequestId(null)}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-500">
              Requested at{' '}
              {new Date(reviewingRequest.requested_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              . The points come off {reviewingRequest.kid_name}'s balance only when a parent approves.
            </p>
            <RedemptionDecision
              request={reviewingRequest}
              requirePin={!!hasPin}
              deviceKey={getApprovalKey()}
              onDecided={() => setReviewingRequestId(null)}
            />
          </div>
        </Modal>
      )}

      {reviewingChoreRequest && (
        <Modal
          title={`${reviewingChoreRequest.kid_name} did ${reviewingChoreRequest.chore_name}?`}
          onClose={() => setReviewingChoreRequestId(null)}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-500">
              Tapped at{' '}
              {new Date(reviewingChoreRequest.requested_at).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
              . Approving adds {reviewingChoreRequest.points}{' '}
              {reviewingChoreRequest.points === 1 ? 'point' : 'points'} to {reviewingChoreRequest.kid_name}'s
              balance.
            </p>
            <ChoreApprovalDecision
              request={reviewingChoreRequest}
              requirePin={!!hasPin}
              deviceKey={getApprovalKey()}
              onDecided={(approved) => {
                setReviewingChoreRequestId(null)
                if (approved) confetti({ particleCount: 90, spread: 80 })
              }}
            />
          </div>
        </Modal>
      )}

      {showHolidayModal && (
        <HolidayModal
          turningOn={!isHoliday}
          requirePin={!!hasPin}
          rolloverHour={pointsDay?.rollover_hour ?? 20}
          onClose={() => setShowHolidayModal(false)}
        />
      )}

      {showHistory && familyMember && (
        <RedemptionHistory familyId={familyMember.family_id} onClose={() => setShowHistory(false)} />
      )}
    </div>
  )
}
