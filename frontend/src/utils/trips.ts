// Границы "нормальной" длительности одного рейса (одного проезда от конечной
// до конечной) — за пределами них рейс считается ошибочным (сбой GPS: рейс
// открылся/закрылся почти мгновенно, либо не закрылся вовремя и провисел
// часами) и не учитывается в подсчёте кругов, пока водитель не подтвердит его
// вручную как верный.
export const MIN_TRIP_MINUTES = 60
export const MAX_TRIP_MINUTES = 180

export function tripDurationMin(t: { started_at: string; ended_at?: string | null }): number | null {
  if (!t.ended_at) return null
  return Math.round((new Date(t.ended_at).getTime() - new Date(t.started_at).getTime()) / 60000)
}

export function isTripErroneous(t: { started_at: string; ended_at?: string | null; override_valid?: boolean }): boolean {
  if (t.override_valid) return false
  const d = tripDurationMin(t)
  if (d == null) return false
  return d < MIN_TRIP_MINUTES || d > MAX_TRIP_MINUTES
}
