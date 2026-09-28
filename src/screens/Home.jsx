import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, UserPlus, Scissors, ChartNoAxesColumn, ChevronRight, LogOut, ClipboardCheck } from 'lucide-react'
import { useShopStore } from '../store/useShopStore'
import { useAuthStore } from '../store/useAuthStore'
import { mergeActivities, isToday, totals } from '../utils/activity'
import StatPill from '../components/StatPill'
import ActivityFeed from '../components/ActivityFeed'
import { ink, line, surface, type, radius, status, primaryDeep, shadow } from '../theme'

export default function Home() {
  const navigate = useNavigate()
  const shopId = useShopStore((s) => s.shopId)
  const providers = useShopStore((s) => s.providers)
  const earningsByProvider = useShopStore((s) => s.earningsByProvider)
  const payoutsByProvider = useShopStore((s) => s.payoutsByProvider)
  const loadProviders = useShopStore((s) => s.loadProviders)
  const loadProviderLogs = useShopStore((s) => s.loadProviderLogs)
  const shopSummary = useShopStore((s) => s.shopSummary)
  const pulling = useShopStore((s) => s.pulling)
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

  // Quick actions. Icons carry the meaning; the old pastel-pink/green/orange
  // tints were off-brand and implied a state that doesn't exist here.
  const quick = [
    ...(me ? [{ label: 'My earnings', path: `/provider/${me.id}`, icon: User }] : []),
    { label: 'Add provider', path: '/add-provider', icon: UserPlus },
    { label: 'Services', path: '/services', icon: Scissors },
    { label: 'Totals', path: '/dashboard', icon: ChartNoAxesColumn },
  ]

  return (
    <div style={{ padding: 16, paddingBottom: 110 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <div style={{ ...type.screen, color: ink.strong }}>{shop?.name || 'Barbershop'}</div>
        <button
          onClick={signOutOwner}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', color: ink.muted,
            ...type.meta, fontWeight: 600, padding: '6px 8px',
          }}
        >
          <LogOut size={15} strokeWidth={2.2} aria-hidden />
          Sign out
        </button>
      </div>
      <div style={{ color: ink.muted, marginBottom: 16, ...type.comment }}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>

      {pending > 0 && (
        <button
          onClick={() => navigate('/requests')}
          style={{
            display: 'flex', alignItems: 'center', gap: 11,
            width: '100%', textAlign: 'left',
            background: status.pending.bg, color: status.pending.fg,
            border: 'none', borderRadius: radius.lg,
            padding: 13, fontWeight: 700, ...type.comment,
            marginBottom: 14, boxShadow: shadow.card,
          }}
        >
          <ClipboardCheck size={19} strokeWidth={2.3} aria-hidden style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            {pending} service {pending === 1 ? 'record is' : 'records are'} waiting for your approval
          </span>
          <ChevronRight size={17} strokeWidth={2.4} aria-hidden style={{ flexShrink: 0 }} />
        </button>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <StatPill label="Earned today" value={day.earned} />
        <StatPill label="Paid today" value={day.paid} accent={status.success.fg} />
        <StatPill label="Owed to team" value={owed} accent={status.pending.fg} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto' }}>
        {quick.map((t) => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              border: `1px solid ${line.hair}`,
              borderRadius: radius.pill, padding: '9px 16px',
              background: surface.card, color: primaryDeep,
              fontWeight: 700, ...type.meta, whiteSpace: 'nowrap',
            }}
          >
            <t.icon size={15} strokeWidth={2.4} aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ ...type.section, color: ink.strong }}>Today's activity ({today.length})</div>
        <button
          onClick={() => navigate('/history')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            background: 'none', border: 'none', color: primaryDeep,
            ...type.meta, fontWeight: 700, padding: '4px 0',
          }}
        >
          See all history
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
      <ActivityFeed
        items={today}
        grouped={false}
        emptyText={pulling ? 'Restoring your history…' : 'No activity yet today. Open a provider to add an earning.'}
      />
    </div>
  )
}
