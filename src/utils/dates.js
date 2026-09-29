export function startOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function startOfWeek(d = new Date()) {
  const x = startOfDay(d)
  const day = x.getDay() // 0 = Sunday
  const diff = (day + 6) % 7 // make Monday the start of week
  x.setDate(x.getDate() - diff)
  return x
}

export function startOfMonth(d = new Date()) {
  const x = startOfDay(d)
  x.setDate(1)
  return x
}

/**
 * Is this row a removed ("voided") activity? Removing an activity never deletes
 * the row — it is stamped so the audit trail keeps it — which means every total
 * has to skip it. The server column is `voided_at`; a row this device removed
 * before that column existed only carries the old client-side `deleted` flag,
 * and is honoured too, so a record removed by an earlier build can't quietly
 * count again.
 */
export function isVoided(row) {
  return !!(row?.voided_at || row?.deleted)
}

export function sumInRange(rows, since) {
  return rows
    .filter((r) => !isVoided(r) && new Date(r.created_at) >= since)
    .reduce((sum, r) => sum + Number(r.amount), 0)
}

export function periodTotals(rows) {
  const now = new Date()
  const live = rows.filter((r) => !isVoided(r))
  return {
    today: sumInRange(live, startOfDay(now)),
    week: sumInRange(live, startOfWeek(now)),
    month: sumInRange(live, startOfMonth(now)),
    all: live.reduce((sum, r) => sum + Number(r.amount), 0),
  }
}
