import { Link } from 'react-router-dom'
import { usePointsHistory } from '../hooks/usePointsHistory'
import { useDashboardInsights } from '../hooks/useDashboardInsights'
import { PointsChart } from '../components/PointsChart'
import { Emoji } from '../components/Emoji'

export function DashboardPage() {
  const { data: history = [], isLoading: historyLoading } = usePointsHistory(14)
  const { data: insights = [], isLoading: insightsLoading } = useDashboardInsights()

  const ignored = insights.filter((i) => i.insight_type === 'ignored')
  const underCompleted = insights.filter((i) => i.insight_type === 'under_completed')

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 bg-white border-b border-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <Link to="/" className="text-sm text-indigo-600 font-medium">
          ← Back to board
        </Link>
      </header>

      <main className="p-4 sm:p-8 flex flex-col gap-6 max-w-5xl mx-auto">
        <section className="rounded-2xl bg-white border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Points earned vs. redeemed (last 14 days)
          </h2>
          {historyLoading ? (
            <p className="text-slate-500">Loading…</p>
          ) : (
            <PointsChart data={history} />
          )}
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <section className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Being ignored</h2>
            <p className="text-sm text-slate-500 mb-4">
              Not completed in the last 3 times they were available.
            </p>
            {insightsLoading ? (
              <p className="text-slate-500">Loading…</p>
            ) : ignored.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing flagged — nice work.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {ignored.map((insight) => (
                  <li
                    key={insight.chore_id}
                    className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <span className="text-sm text-slate-800 inline-flex items-center gap-1.5">
                      {insight.chore_emoji && <Emoji emoji={insight.chore_emoji} className="h-3.5 w-3.5" />}
                      <span>
                        {insight.chore_name}{' '}
                        <span className="text-slate-500">— {insight.member_name}</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Not fully completed</h2>
            <p className="text-sm text-slate-500 mb-4">
              Multi-rep chores rarely reaching their full count.
            </p>
            {insightsLoading ? (
              <p className="text-slate-500">Loading…</p>
            ) : underCompleted.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing flagged — nice work.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {underCompleted.map((insight) => (
                  <li
                    key={insight.chore_id}
                    className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <span className="text-sm text-slate-800 inline-flex items-center gap-1.5">
                      {insight.chore_emoji && <Emoji emoji={insight.chore_emoji} className="h-3.5 w-3.5" />}
                      <span>
                        {insight.chore_name}{' '}
                        <span className="text-slate-500">— {insight.member_name}</span>
                      </span>
                    </span>
                    <span className="text-xs text-slate-500">{insight.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
