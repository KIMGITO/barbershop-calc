import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'
import StatPill from '../components/StatPill'
import ActivityFeed from '../components/ActivityFeed'
import SelfRecordToggle from '../components/SelfRecordToggle'
import { useAuthStore } from '../store/useAuthStore'
import { mergeActivities } from '../utils/activity'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { brand, ink, line, shadow, surface, type, radius, status } from '../theme'
import { Button, IconButton } from '../components/ui'

export default function ProviderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const providers = useShopStore((s) => s.providers)
  const loadProviderLogs = useShopStore((s) => s.loadProviderLogs)
  const providerSummary = useShopStore((s) => s.providerSummary)
  const earnings = useShopStore((s) => s.earningsByProvider[id] || [])
  const payouts = useShopStore((s) => s.payoutsByProvider[id] || [])

  const provider = providers.find((p) => p.id === id)
  const ownerPhone = useAuthStore((s) => s.shop?.owner_phone)

  useEffect(() => {
    loadProviderLogs(id)
  }, [id])

  if (!provider) return null

  const { earned, paid, owed } = providerSummary(id)

  // Merge earnings + payouts into one activity feed, newest first.
  const feed = mergeActivities(earnings, payouts, () => provider.name)

  return (
    <div style={{ background: surface.page, minHeight: '100vh', paddingBottom: 90 }}>
      {/* Header photo section */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            height: 210,
            // Palette gradient: black melting into the card surface.
            background: 'var(--gradient-dark)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <img
            src={provider.photo_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + provider.name}
            alt={provider.name}
            style={{
              width: 118, height: 118, borderRadius: '50%', objectFit: 'cover',
              marginBottom: -40, border: `4px solid ${brand.white}`,
              background: brand.white,
            }}
          />
        </div>
        <div style={{ position: 'absolute', top: 16, left: 16 }}>
          <IconButton icon={ArrowLeft} label="Go back" onClick={() => navigate(-1)} />
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          background: surface.card, borderRadius: `${radius.xl}px ${radius.xl}px 0 0`, marginTop: -16,
          padding: '48px 18px 18px', position: 'relative',
          boxShadow: shadow.nav,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          {/* Profile header name: the brand's "username" role, one step up. */}
          <div style={{ ...type.name, color: ink.strong }}>{provider.name}</div>
          <div style={{ ...type.meta, color: ink.muted, marginTop: 2 }}>
            {provider.role_title || 'Service provider'} · {provider.phone}
          </div>
        </div>

        {provider.phone !== ownerPhone && <SelfRecordToggle provider={provider} />}

        {/* Action buttons, replacing Call / Message */}
        <div style={{ display: 'flex', gap: 10, margin: '16px 0' }}>
          <Button
            variant="soft"
            icon={TrendingUp}
            onClick={() => navigate(`/provider/${id}/add-earning`)}
          >
            Add Earning
          </Button>
          <Button
            icon={TrendingDown}
            onClick={() => navigate(`/provider/${id}/add-payout`)}
            style={{ background: status.success.solid, borderColor: status.success.solid }}
          >
            Add Payout
          </Button>
        </div>

        {/* Totals row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <StatPill label="Today" value={earned.today} />
          <StatPill label="This Week" value={earned.week} />
          <StatPill label="This Month" value={earned.month} />
        </div>

        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: surface.subtle, borderRadius: radius.lg, padding: '12px 16px', marginBottom: 18,
            border: `1px solid ${line.soft}`,
          }}
        >
          <div>
            <div style={{ ...type.metaSm, color: ink.muted }}>Earned all-time</div>
            <div className="tnum" style={{ ...type.handle, color: ink.strong }}>KES {earned.all.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ ...type.metaSm, color: ink.muted }}>Paid out</div>
            <div className="tnum" style={{ ...type.handle, color: ink.strong }}>KES {paid.all.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...type.metaSm, color: ink.muted }}>Owed</div>
            <div
              className="tnum"
              style={{ ...type.handle, color: owed > 0 ? status.pending.fg : status.success.fg }}
            >
              KES {owed.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ ...type.section, color: ink.strong, marginBottom: 10 }}>
          Activity ({feed.length})
        </div>

        <ActivityFeed items={feed} showProvider={false} emptyText="No entries yet." />
      </div>
    </div>
  )
}
