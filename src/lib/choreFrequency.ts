import type { Chore, ChoreFrequencyType } from './database.types'

export const FREQUENCY_OPTIONS: { value: ChoreFrequencyType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays only' },
  { value: 'weekends', label: 'Weekends only' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'every_n_days', label: 'Every N days' },
]

const PERIOD_NOUN: Record<ChoreFrequencyType, string> = {
  daily: 'day',
  weekdays: 'day',
  weekends: 'day',
  weekly: 'week',
  monthly: 'month',
  every_n_days: 'cycle',
}

export function timesPerPeriodLabel(frequencyType: ChoreFrequencyType) {
  return `Times per ${PERIOD_NOUN[frequencyType]}`
}

export function describeFrequency(chore: Pick<Chore, 'frequency_type' | 'times_per_period' | 'interval_days'>) {
  const times = chore.times_per_period

  switch (chore.frequency_type) {
    case 'daily':
      return times > 1 ? `${times}x a day` : 'Daily'
    case 'weekdays':
      return times > 1 ? `${times}x a day, weekdays` : 'Weekdays'
    case 'weekends':
      return times > 1 ? `${times}x a day, weekends` : 'Weekends'
    case 'weekly':
      return times > 1 ? `${times}x a week` : 'Weekly'
    case 'monthly':
      return times > 1 ? `${times}x a month` : 'Monthly'
    case 'every_n_days':
      return times > 1
        ? `${times}x every ${chore.interval_days} days`
        : `Every ${chore.interval_days} days`
  }
}
