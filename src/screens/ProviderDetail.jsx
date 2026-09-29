import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'
import StatPill from '../components/StatPill'
import ActivityFeed from '../components/ActivityFeed'
import SelfRecordToggle from '../components/SelfRecordToggle'
import RecordActions from '../components/RecordActions'
import Avatar from '../components/Avatar'
import { useAuthStore } from '../store/useAuthStore'
import { mergeActivities } from '../utils/activity'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { brand, ink, line, surface, type, radius, status } from '../theme'
import { Button, IconButton, Screen, Card } from '../components/ui'

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
    <Screen>
      {/* Navigation header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconButton icon={ArrowLeft} label="Go back" onClick={() => navigate(-1)} />
          <div style={{ ...type.screen, color: ink.strong }}>Provider Details</div>
        </div>
        {provider.phone !== ownerPhone && (
          <RecordActions record={{ kind: 'provider', id: provider.id }} data={provider} />
        )}
      </div>

      {/* Profile Overview Card */}
      <Card style={{ marginBottom: 12, padding: '14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Avatar
            src={provider.photo_url}
            name={provider.name}
            size={56}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...type.name, color: ink.strong, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {provider.name}
            </div>
            <div style={{ ...type.meta, color: ink.muted, marginTop: 2 }}>
              {provider.role_title || 'Service provider'} · {provider.phone}
            </div>
          </div>
        </div>

        {provider.phone !== ownerPhone && (
          <div style={{ marginBottom: 12 }}>
            <SelfRecordToggle provider={provider} />
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="soft"
            icon={TrendingUp}
            full
            onClick={() => navigate(`/provider/${id}/add-earning`)}
          >
            Add Earning
          </Button>
          <Button
            icon={TrendingDown}
            full
            onClick={() => navigate(`/provider/${id}/add-payout`)}
            style={{ background: status.success.solid, borderColor: status.success.solid }}
          >
            Add Payout
          </Button>
        </div>
      </Card>

      {/* Period Totals Row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <StatPill label="Today" value={earned.today} />
        <StatPill label="This Week" value={earned.week} />
        <StatPill label="This Month" value={earned.month} />
      </div>

      {/* All-time Summary Row */}
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: surface.card, borderRadius: radius.lg, padding: '10px 12px', marginBottom: 14,
          border: `1px solid ${line.hair}`,
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

      <div style={{ ...type.section, color: ink.strong, marginBottom: 8 }}>
        Activity ({feed.length})
      </div>

      <ActivityFeed items={feed} showProvider={false} emptyText="No entries yet." />
    </Screen>
  )
}
