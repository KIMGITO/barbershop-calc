import { useNavigate } from 'react-router-dom'
import { useProviderStore } from '../store/useProviderStore'
import { periodTotals } from '../utils/dates'
import { mergeActivities, isToday, money } from '../utils/activity'
import StatPill from '../components/StatPill'
import ActivityFeed from '../components/ActivityFeed'

// A provider's own "Today" screen — read-only. Only the admin's device writes.
export default function ProviderHome() {
  const navigate = useNavigate()
  const { provider, earnings, payouts, requests, loading, error } = useProviderStore()

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>
  if (!provider) return <div style={{ padding: 24, color: '#D9482B' }}>{error}</div>

  const earned = periodTotals(earnings)
  const paid = periodTotals(payouts)
  const owed = earned.all - paid.all
  const waiting = requests.filter((r) => r.status === 'pending').length
  const today = mergeActivities(earnings, payouts, () => provider.name).filter(isToday)

  return (
    <div style={{ padding: 16, paddingBottom: 110 }}>
      <div style={{
        background: 'linear-gradient(135deg, #7C5CFC 0%, #A58BFF 100%)', color: '#fff',
        borderRadius: 24, padding: 18, marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <img
            src={provider.photo_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(provider.name)}
            alt={provider.name}
            style={{ width: 52, height: 52, borderRadius: 16, objectFit: 'cover', background: 'rgba(255,255,255,0.3)' }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Hi, {provider.name.split(' ')[0]}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{provider.role_title}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>{owed >= 0 ? 'Owed to you' : 'Paid ahead'}</div>
        <div style={{ fontSize: 30, fontWeight: 800, margin: '2px 0 10px' }}>{money(Math.abs(owed))}</div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          Earned {money(earned.all)} · Paid to you {money(paid.all)}
        </div>
      </div>

      {provider.can_self_record && (
        <button
          onClick={() => navigate('/record')}
          style={{ width: '100%', background: '#F1EBFF', color: '#6B4BE0', border: 'none', borderRadius: 14, padding: 14, fontWeight: 700, fontSize: 14, marginBottom: 14, textAlign: 'left' }}
        >
          + Record a service
          {waiting > 0 && <span style={{ float: 'right', color: '#D9822B', fontSize: 12 }}>{waiting} waiting for approval</span>}
        </button>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <StatPill label="Today" value={earned.today} />
        <StatPill label="This week" value={earned.week} />
        <StatPill label="This month" value={earned.month} />
      </div>

      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Today's activity ({today.length})</div>
      <ActivityFeed items={today} showProvider={false} grouped={false} emptyText="No activity yet today." />
    </div>
  )
}
