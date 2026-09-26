import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getDeviceToken } from '../lib/db'
import { periodTotals } from '../utils/dates'
import StatPill from '../components/StatPill'

// Read-only view for a claimed service provider. Nothing here is editable —
// providers can see their own numbers but only the owner's device writes.
export default function ProviderHome() {
  const [provider, setProvider] = useState(null)
  const [earnings, setEarnings] = useState([])
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const token = await getDeviceToken()
      if (!token) { setLoading(false); return }
      const { data, error } = await supabase.rpc('get_provider_view', { p_token: token })
      if (!error && data?.[0]) {
        setProvider(data[0].provider)
        setEarnings(data[0].earnings_json || [])
        setPayouts(data[0].payouts_json || [])
      }
      setLoading(false)
    })()
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>
  if (!provider) return <div style={{ padding: 24 }}>Could not load your account. Ask the owner to check your access.</div>

  const earned = periodTotals(earnings)
  const paid = periodTotals(payouts)
  const feed = [
    ...earnings.map((e) => ({ ...e, kind: 'earning' })),
    ...payouts.map((p) => ({ ...p, kind: 'payout' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <img
          src={provider.photo_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + provider.name}
          alt={provider.name}
          style={{ width: 56, height: 56, borderRadius: 16, objectFit: 'cover' }}
        />
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{provider.name}</div>
          <div style={{ fontSize: 12, color: '#8A8A9A' }}>{provider.role_title}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <StatPill label="Today" value={earned.today} />
        <StatPill label="This Week" value={earned.week} />
        <StatPill label="This Month" value={earned.month} />
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', background: '#FBF7EE',
        borderRadius: 14, padding: '12px 16px', marginBottom: 18,
      }}>
        <div>
          <div style={{ fontSize: 12, color: '#8A8A9A' }}>Earned all-time</div>
          <div style={{ fontWeight: 700 }}>KES {earned.all.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#8A8A9A' }}>Paid to you</div>
          <div style={{ fontWeight: 700 }}>KES {paid.all.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ fontWeight: 700, marginBottom: 10 }}>Activity</div>
      {feed.map((item) => (
        <div key={item.id} style={{
          display: 'flex', justifyContent: 'space-between', background: '#fff',
          border: '1px solid #F0EEF7', borderRadius: 14, padding: 14, marginBottom: 8,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {item.kind === 'earning' ? (item.note || 'Service earning') : `Payout · ${item.method}`}
            </div>
            <div style={{ fontSize: 12, color: '#8A8A9A' }}>{new Date(item.created_at).toLocaleString()}</div>
          </div>
          <div style={{ fontWeight: 700, color: item.kind === 'earning' ? '#2FA866' : '#D9822B' }}>
            {item.kind === 'earning' ? '+' : '-'}KES {Number(item.amount).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}
