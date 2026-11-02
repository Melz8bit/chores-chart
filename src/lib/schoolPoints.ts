// Mirrors the school-day rule in public.family_points_day (0021) and
// get_kiosk_board / complete_chore (0022): a chore's custom school_points
// when set, otherwise its full points divided by this, rounded up. Keep in
// sync with the SQL if the divisor changes again.
export const SCHOOL_DAY_DIVISOR = 3

export function autoSchoolPoints(points: number): number {
  return Math.max(1, Math.ceil(points / SCHOOL_DAY_DIVISOR))
}

// Local hours a family can pick for the points-day rollover (families.
// rollover_hour, 0023): 5pm through 11pm, plus 0 = midnight (no shift).
export const ROLLOVER_HOURS = [17, 18, 19, 20, 21, 22, 23, 0]

export function formatRolloverHour(hour: number): string {
  if (hour === 0) return 'midnight'
  if (hour === 12) return 'noon'
  return `${hour > 12 ? hour - 12 : hour}pm`
}

export function schoolDayPoints(chore: { points: number; school_points: number | null }): number {
  return chore.school_points ?? autoSchoolPoints(chore.points)
}
