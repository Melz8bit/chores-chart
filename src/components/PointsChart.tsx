import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PointsHistoryDay } from '../hooks/usePointsHistory'

// Validated categorical pair (dataviz skill): slot 1 blue = earned, slot 2
// aqua = redeemed, fixed order, never swapped.
const EARNED_COLOR = '#2a78d6'
const REDEEMED_COLOR = '#1baf7a'

function formatDay(iso: string) {
  const date = new Date(`${iso}T00:00:00`)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm text-sm">
      <p className="text-slate-500 mb-1">{label ? formatDay(label) : ''}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="font-semibold text-slate-900">{entry.value}</span>
          <span className="text-slate-500">{entry.name}</span>
        </p>
      ))}
    </div>
  )
}

export function PointsChart({ data }: { data: PointsHistoryDay[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e1e0d9" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={formatDay}
            tick={{ fill: '#898781', fontSize: 12 }}
            axisLine={{ stroke: '#c3c2b7' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#898781', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f0efec' }} />
          <Legend
            iconType="rect"
            wrapperStyle={{ fontSize: 13, color: '#52514e' }}
          />
          <Bar
            dataKey="earned"
            name="Earned"
            fill={EARNED_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
          <Bar
            dataKey="redeemed"
            name="Redeemed"
            fill={REDEEMED_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
