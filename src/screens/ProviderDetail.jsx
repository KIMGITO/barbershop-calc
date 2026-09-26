import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'
import StatPill from '../components/StatPill'

export default function ProviderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const providers = useShopStore((s) => s.providers)
  const loadProviderLogs = useShopStore((s) => s.loadProviderLogs)
  const providerSummary = useShopStore((s) => s.providerSummary)
  const earnings = useShopStore((s) => s.earningsByProvider[id] || [])
  const payouts = useShopStore((s) => s.payoutsByProvider[id] || [])

  const provider = providers.find((p) => p.id === id)

  useEffect(() => {
    loadProviderLogs(id)
  }, [id])

  if (!provider) return null

  const { earned, paid, owed } = providerSummary(id)

  // Merge earnings + payouts into one activity feed, newest first.
  const feed = [
    ...earnings.map((e) => ({ ...e, kind: 'earning' })),
    ...payouts.map((p) => ({ ...p, kind: 'payout' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return (
    <div style={{ background: '#F4F2FA', minHeight: '100vh', paddingBottom: 90 }}>
      {/* Header photo section */}
      <div style={{ position: 'relative' }}>
        <div style={{
          height: 220,
          background: 'linear-gradient(180deg, #DCEBEF 0%, #ECE4F4 100%)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <img
            src={provider.photo_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + provider.name}
            alt={provider.name}
            style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', marginBottom: -40, border: '4px solid #fff' }}
          />
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.8)', border: 'none', fontSize: 18,
          }}
        >‹</button>
      </div>

      {/* Card */}
      <div style={{
        background: '#fff', borderRadius: '24px 24px 0 0', marginTop: -16,
        padding: '48px 18px 18px', position: 'relative',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{provider.name}</div>
          <div style={{ fontSize: 13, color: '#8A8A9A' }}>{provider.role_title} · {provider.phone}</div>
        </div>

        {/* Action buttons, replacing Call / Message */}
        <div style={{ display: 'flex', gap: 10, margin: '16px 0' }}>
          <button
            onClick={() => navigate(`/provider/${id}/add-earning`)}
            style={{ flex: 1, background: '#F1EBFF', color: '#7C5CFC', border: 'none', borderRadius: 14, padding: '12px 0', fontWeight: 600 }}
          >
            + Add Earning
          </button>
          <button
            onClick={() => navigate(`/provider/${id}/add-payout`)}
            style={{ flex: 1, background: '#EAF6EF', color: '#2FA866', border: 'none', borderRadius: 14, padding: '12px 0', fontWeight: 600 }}
          >
            + Add Payout
          </button>
        </div>

        {/* Totals row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <StatPill label="Today" value={earned.today} />
          <StatPill label="This Week" value={earned.week} />
          <StatPill label="This Month" value={earned.month} />
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#FBF7EE', borderRadius: 14, padding: '12px 16px', marginBottom: 18,
        }}>
          <div>
            <div style={{ fontSize: 12, color: '#8A8A9A' }}>Earned all-time</div>
            <div style={{ fontWeight: 700 }}>KES {earned.all.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8A8A9A' }}>Paid out</div>
            <div style={{ fontWeight: 700 }}>KES {paid.all.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#8A8A9A' }}>Owed</div>
            <div style={{ fontWeight: 700, color: owed > 0 ? '#D9822B' : '#2FA866' }}>
              KES {owed.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
          Activity ({feed.length})
        </div>

        {feed.length === 0 && (
          <div style={{ color: '#8A8A9A', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No entries yet.
          </div>
        )}

        {feed.map((item) => (
          <div key={item.local_id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#fff', border: '1px solid #F0EEF7', borderRadius: 14,
            padding: '12px 14px', marginBottom: 8,
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {item.kind === 'earning' ? (item.note || 'Service earning') : `Payout · ${item.method}${item.mpesa_code ? ' · ' + item.mpesa_code : ''}`}
              </div>
              <div style={{ fontSize: 12, color: '#8A8A9A' }}>
                {new Date(item.created_at).toLocaleString()}
                {item.pending ? ' · syncing…' : ''}
              </div>
            </div>
            <div style={{ fontWeight: 700, color: item.kind === 'earning' ? '#2FA866' : '#D9822B' }}>
              {item.kind === 'earning' ? '+' : '-'}KES {Number(item.amount).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
