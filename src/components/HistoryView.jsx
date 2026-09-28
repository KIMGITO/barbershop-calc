import { useMemo, useState } from 'react'
import ActivityFeed from './ActivityFeed'
import { matchesQuery, totals, money } from '../utils/activity'

const chip = (active) => ({
  padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: 'none',
  background: active ? '#7C5CFC' : '#fff', color: active ? '#fff' : '#6E6E82',
})

// Searchable audit history. `providers` (optional) enables a provider filter.
export default function HistoryView({ activities, providers }) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('all')
  const [providerId, setProviderId] = useState('all')

  const filtered = useMemo(
    () => activities.filter((a) =>
      (kind === 'all' || a.kind === kind) &&
      (providerId === 'all' || a.providerId === providerId) &&
      matchesQuery(a, q)),
    [activities, q, kind, providerId],
  )
  const sum = totals(filtered)

  return (
    <div style={{ paddingBottom: 110 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#F4F2FA', padding: '16px 16px 10px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>History</div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search services, people, notes, M-Pesa codes…"
          style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #E0DEEB', fontSize: 14, marginBottom: 10, background: '#fff' }}
        />
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          <button style={chip(kind === 'all')} onClick={() => setKind('all')}>All</button>
          <button style={chip(kind === 'earning')} onClick={() => setKind('earning')}>Earnings</button>
          <button style={chip(kind === 'payout')} onClick={() => setKind('payout')}>Payouts</button>
        </div>
        {providers && providers.length > 1 && (
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 12, border: '1px solid #E0DEEB', marginTop: 10, background: '#fff', fontSize: 13 }}
          >
            <option value="all">All providers</option>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <div style={{ fontSize: 12, color: '#8A8A9A', marginTop: 10 }}>
          {filtered.length} {filtered.length === 1 ? 'activity' : 'activities'} · Earned {money(sum.earned)} · Paid {money(sum.paid)}
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <ActivityFeed
          items={filtered}
          showProvider={!providers || providers.length > 0}
          emptyText={q || kind !== 'all' || providerId !== 'all' ? 'No activity matches your search.' : 'No activity yet.'}
        />
      </div>
    </div>
  )
}
