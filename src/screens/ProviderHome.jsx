import { useNavigate } from 'react'
import { useProviderStore } from '../store/useProviderStore'
import { periodTotals } from '../utils/dates'
import { mergeActivities, isToday, money } from '../utils/activity'
import StatPill from '../components/StatPill'
import ActivityFeed from '../components/ActivityFeed'
import Avatar from '../components/Avatar'
import { Screen, ErrorText } from '../components/ui'
import { Plus, Clock } from 'lucide-react'
import { brand, shadow, surface, type, radius, status, primaryDeep } from '../theme'

export default function ProviderHome() {
  const navigate = useNavigate()
  const { provider, earnings, payouts, requests, loading, error } = useProviderStore()

  if (loading) return <div style={{ padding: 20, ...type.body, color: 'inherit' }}>Loading…</div>
  if (!provider) {
    return (
      <div style={{ padding: 20 }}>
        <ErrorText>{error || 'Your account could not be loaded. Ask the owner to check your number.'}</ErrorText>
      </div>
    )
  }

  const earned = periodTotals(earnings)
  const paid = periodTotals(payouts)
  const owed = earned.all - paid.all
  const waiting = requests.filter((r) => r.status === 'pending').length
  const today = mergeActivities(earnings, payouts, () => provider.name).filter(isToday)

  return (
    <Screen>
      {/* Balance hero */}
      <div
        style={{
          background: 'var(--gradient-dark-warm)',
          color: brand.white,
          borderRadius: radius.xl, padding: '14px 16px', marginBottom: 12,
          boxShadow: shadow.glow,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Avatar
            src={provider.photo_url}
            name={provider.name}
            size={46}
            square
          />
          <div style={{ minWidth: 0 }}>
            <div style={type.name}>Hi, {provider.name.split(' ')[0]}</div>
            <div style={{ ...type.meta, opacity: 0.88 }}>{provider.role_title || 'Service provider'}</div>
          </div>
        </div>

        <div style={{ ...type.metaSm, opacity: 0.88 }}>{owed >= 0 ? 'Owed to you' : 'Paid ahead'}</div>
        <div className="tnum" style={{ ...type.display, margin: '2px 0 6px' }}>
          {money(Math.abs(owed))}
        </div>
        <div style={{ ...type.metaSm, opacity: 0.92 }}>
          Earned {money(earned.all)} · Paid to you {money(paid.all)}
        </div>
      </div>

      {provider.can_self_record && (
        <button
          onClick={() => navigate('/record')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            background: surface.card, color: primaryDeep,
            border: `1px solid ${brand.mid}`, borderRadius: radius.lg,
            padding: '10px 12px', marginBottom: 12, textAlign: 'left',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 32, height: 32, borderRadius: radius.sm, flexShrink: 0,
              background: surface.wash, color: primaryDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Plus size={18} strokeWidth={2.6} />
          </span>
          <span style={{ ...type.body, fontWeight: 600, flex: 1, minWidth: 0 }}>Record a service</span>
          {waiting > 0 && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                color: status.pending.fg, ...type.metaSm, fontWeight: 600, flexShrink: 0,
              }}
            >
              <Clock size={12} strokeWidth={2.5} aria-hidden />
              {waiting} waiting
            </span>
          )}
        </button>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <StatPill label="Today" value={earned.today} />
        <StatPill label="This week" value={earned.week} />
        <StatPill label="This month" value={earned.month} />
      </div>

      <div style={{ ...type.section, color: 'inherit', marginBottom: 6 }}>
        Today's activity ({today.length})
      </div>
      <ActivityFeed items={today} showProvider={false} grouped={false} emptyText="No activity yet today." />
    </Screen>
  )
}
