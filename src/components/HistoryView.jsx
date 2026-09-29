import { useMemo, useState } from 'react'
import { Search, TrendingUp, TrendingDown, Layers, X, Users } from 'lucide-react'
import ActivityFeed from './ActivityFeed'
import Select from './Select'
import { brand, ink, line, shadow, surface, type, radius, primaryDeep } from '../theme'
import { matchesQuery, totals, money } from '../utils/activity'

const KINDS = [
  { value: 'all', label: 'All', icon: Layers },
  { value: 'earning', label: 'Earnings', icon: TrendingUp },
  { value: 'payout', label: 'Payouts', icon: TrendingDown },
]

const chip = (active) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', borderRadius: radius.pill,
  ...type.meta, fontWeight: active ? 600 : 500,
  border: `1px solid ${active ? brand.primary : line.hair}`,
  background: active ? brand.primary : surface.card,
  color: active ? brand.white : ink.soft,
})

export default function HistoryView({ activities, providers, loading = false }) {
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
  const showProviderFilter = providers && providers.length > 1

  return (
    <div style={{ paddingBottom: 95 }}>
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: surface.page,
          padding: '12px 14px 8px',
          boxShadow: shadow.header,
        }}
      >
        <div style={{ ...type.screen, color: ink.strong, marginBottom: 10 }}>History</div>

        <div style={{ position: 'relative', marginBottom: 8 }}>
          <Search
            size={16} color={ink.muted} strokeWidth={2.2} aria-hidden
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search services, people, notes, M-Pesa codes…"
            aria-label="Search activity"
            style={{
              width: '100%', padding: '8px 34px 8px 34px', minHeight: 40,
              borderRadius: radius.md, border: `1px solid ${line.hair}`,
              background: surface.card, color: ink.strong, ...type.body,
            }}
          />
          {q && (
            <button
              onClick={() => setQ('')}
              aria-label="Clear search"
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                width: 26, height: 26, borderRadius: radius.pill, border: 'none',
                background: surface.subtle, color: ink.soft,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={13} strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {KINDS.map((k) => (
            <button key={k.value} style={chip(kind === k.value)} onClick={() => setKind(k.value)} aria-pressed={kind === k.value}>
              <k.icon size={13} strokeWidth={2.4} aria-hidden />
              {k.label}
            </button>
          ))}
        </div>

        {showProviderFilter && (
          <div style={{ marginTop: 8 }}>
            <Select
              value={providerId}
              onChange={setProviderId}
              ariaLabel="Filter by provider"
              icon={Users}
              options={[
                { value: 'all', label: 'All providers' },
                ...providers.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>
        )}

        <div
          role="status"
          aria-live="polite"
          style={{ ...type.metaSm, color: ink.muted, marginTop: 8, marginBottom: 4 }}
        >
          {filtered.length} {filtered.length === 1 ? 'activity' : 'activities'} ·{' '}
          <span className="tnum" style={{ color: primaryDeep, fontWeight: 700 }}>{money(sum.earned)}</span> earned ·{' '}
          <span className="tnum" style={{ fontWeight: 700 }}>{money(sum.paid)}</span> paid
        </div>
      </div>

      <div style={{ padding: '0 14px' }}>
        <ActivityFeed
          items={filtered}
          showProvider={!providers || providers.length > 0}
          emptyText={
            loading
              ? 'Restoring your history…'
              : q || kind !== 'all' || providerId !== 'all'
                ? 'No activity matches your search.'
                : 'No activity yet.'
          }
        />
      </div>
    </div>
  )
}
