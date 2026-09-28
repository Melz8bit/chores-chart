// Mirrors the school-day rule in public.family_points_day (0021) and
// get_kiosk_board / complete_chore (0022): a chore's custom school_points
// when set, otherwise its full points divided by this, rounded up. Keep in
// sync with the SQL if the divisor changes again.
export const SCHOOL_DAY_DIVISOR = 3

export function autoSchoolPoints(points: number): number {
  return Math.max(1, Math.ceil(points / SCHOOL_DAY_DIVISOR))
}

export function schoolDayPoints(chore: { points: number; school_points: number | null }): number {
  return chore.school_points ?? autoSchoolPoints(chore.points)
}
