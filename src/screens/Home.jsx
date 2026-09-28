import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'
import { useAuthStore } from '../store/useAuthStore'
import { mergeActivities, isToday, totals } from '../utils/activity'
import StatPill from '../components/StatPill'
import ActivityFeed from '../components/ActivityFeed'

export default function Home() {
  const navigate = useNavigate()
  const shopId = useShopStore((s) => s.shopId)
  const providers = useShopStore((s) => s.providers)
  const earningsByProvider = useShopStore((s) => s.earningsByProvider)
  const payoutsByProvider = useShopStore((s) => s.payoutsByProvider)
  const loadProviders = useShopStore((s) => s.loadProviders)
  const loadProviderLogs = useShopStore((s) => s.loadProviderLogs)
  const shopSummary = useShopStore((s) => s.shopSummary)
  const signOutOwner = useAuthStore((s) => s.signOutOwner)
  const shop = useAuthStore((s) => s.shop)
  const pending = useShopStore((s) => s.requests.filter((r) => r.status === 'pending').length)

  useEffect(() => {
    if (!shopId) return
    loadProviders(shopId).then((list) => list.forEach((p) => loadProviderLogs(p.id)))
  }, [shopId])

  // The admin is also a provider: their own record shares their phone number.
  const me = providers.find((p) => p.phone === shop?.owner_phone)

  const nameOf = (id) => providers.find((p) => p.id === id)?.name || ''
  const all = mergeActivities(
    providers.flatMap((p) => earningsByProvider[p.id] || []),
    providers.flatMap((p) => payoutsByProvider[p.id] || []),
    nameOf,
  )
  const today = all.filter(isToday)
  const day = totals(today)
  const { owed } = shopSummary()

  const quick = [
    ...(me ? [{ label: 'My earnings', path: `/provider/${me.id}`, bg: '#FDECF3', color: '#D93C7A' }] : []),
    { label: '+ Add provider', path: '/add-provider', bg: '#EAF7EF', color: '#2FA866' },
    { label: 'Services', path: '/services', bg: '#FFF3E6', color: '#D9822B' },
    { label: 'Totals', path: '/dashboard', bg: '#EAF1FF', color: '#2E6BE0' },
  ]

  return (
    <div style={{ padding: 16, paddingBottom: 110 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{shop?.name || 'Barbershop'}</div>
        <button onClick={signOutOwner} style={{ background: 'none', border: 'none', color: '#8A8A9A', fontSize: 12 }}>
          Sign out
        </button>
      </div>
      <div style={{ color: '#8A8A9A', marginBottom: 16, fontSize: 13 }}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>

      {pending > 0 && (
        <button
          onClick={() => navigate('/requests')}
          style={{ width: '100%', textAlign: 'left', background: '#FFF3E6', color: '#B96A12', border: 'none', borderRadius: 14, padding: 14, fontWeight: 700, fontSize: 13, marginBottom: 14 }}
        >
          {pending} service {pending === 1 ? 'record is' : 'records are'} waiting for your approval →
        </button>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <StatPill label="Earned today" value={day.earned} />
        <StatPill label="Paid today" value={day.paid} accent="#2FA866" />
        <StatPill label="Owed to team" value={owed} accent="#D9822B" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto' }}>
        {quick.map((t) => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            style={{ border: 'none', borderRadius: 999, padding: '9px 16px', background: t.bg, color: t.color, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Today's activity ({today.length})</div>
        <button onClick={() => navigate('/history')} style={{ background: 'none', border: 'none', color: '#7C5CFC', fontSize: 12, fontWeight: 600 }}>
          See all history
        </button>
      </div>
      <ActivityFeed items={today} grouped={false} emptyText="No activity yet today. Open a provider to add an earning." />
    </div>
  )
}
