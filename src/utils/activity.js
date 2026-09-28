import { startOfDay } from './dates'

// An "activity" is one row in the audit trail: either an earning (a visit,
// with the services selected) or a payout. Everything needed to audit it
// is carried on the object itself.

export const money = (n) => `KES ${Number(n || 0).toLocaleString()}`

const METHOD_LABEL = { cash: 'Cash', mpesa: 'M-Pesa', bank: 'Bank' }

export function toActivity(row, kind, providerName = '') {
  const services = Array.isArray(row.services) ? row.services : []
  return {
    key: `${kind}-${row.local_id || row.id}`,
    refId: row.local_id || row.id,
    kind,
    providerId: row.provider_id,
    providerName,
    amount: Number(row.amount),
    services,
    note: row.note || '',
    method: row.method || '',
    mpesaCode: row.mpesa_code || '',
    createdAt: row.created_at,
    pending: !!row.pending,
    source: row.source || 'admin',
    submission: row.submission || null,
  }
}

export function mergeActivities(earnings, payouts, nameOf = () => '') {
  return [
    ...earnings.map((e) => toActivity(e, 'earning', nameOf(e.provider_id))),
    ...payouts.map((p) => toActivity(p, 'payout', nameOf(p.provider_id))),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function activityTitle(a) {
  if (a.kind === 'payout') return `Payout · ${METHOD_LABEL[a.method] || a.method}`
  if (a.services.length) return a.services.map((s) => s.name).join(' + ')
  return a.note || 'Earning'
}

export function methodLabel(m) { return METHOD_LABEL[m] || m }

export function isToday(a) {
  return new Date(a.createdAt) >= startOfDay()
}

export function dayLabel(iso) {
  const d = startOfDay(new Date(iso))
  const today = startOfDay()
  const diffDays = Math.round((today - d) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

// Every word typed must appear somewhere in the activity: provider,
// services, note, payment method, M-Pesa code, amount, date/time.
export function matchesQuery(a, query) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return true
  const hay = [
    a.providerName,
    a.kind === 'earning' ? 'earning service services' : 'payout paid',
    a.source === 'provider_request' ? 'self-recorded provider request approved' : '',
    activityTitle(a),
    ...a.services.flatMap((s) => [s.name, String(s.price ?? '')]),
    a.note, a.method, methodLabel(a.method), a.mpesaCode,
    String(a.amount),
    new Date(a.createdAt).toLocaleString(),
    dayLabel(a.createdAt),
  ].join(' ').toLowerCase()
  return tokens.every((t) => hay.includes(t))
}

export function groupByDay(items) {
  const groups = []
  for (const a of items) {
    const label = dayLabel(a.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(a)
    else groups.push({ label, items: [a] })
  }
  return groups
}

export function totals(items) {
  let earned = 0
  let paid = 0
  for (const a of items) {
    if (a.kind === 'earning') earned += a.amount
    else paid += a.amount
  }
  return { earned, paid }
}

// Did the admin change what the provider originally submitted?
export function wasEdited(a) {
  const sub = a.submission
  if (!sub) return false
  const ids = (list) => JSON.stringify((list || []).map((s) => s.id).sort())
  return Number(sub.amount) !== a.amount || ids(sub.services) !== ids(a.services) || (sub.note || '') !== (a.note || '')
}
