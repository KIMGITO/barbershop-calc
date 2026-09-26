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

export function sumInRange(rows, since) {
  return rows
    .filter((r) => new Date(r.created_at) >= since)
    .reduce((sum, r) => sum + Number(r.amount), 0)
}

export function periodTotals(rows) {
  const now = new Date()
  return {
    today: sumInRange(rows, startOfDay(now)),
    week: sumInRange(rows, startOfWeek(now)),
    month: sumInRange(rows, startOfMonth(now)),
    all: rows.reduce((sum, r) => sum + Number(r.amount), 0),
  }
}
