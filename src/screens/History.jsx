import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'

export default function History() {
  const navigate = useNavigate()
  const providers = useShopStore((s) => s.providers)
  const earningsByProvider = useShopStore((s) => s.earningsByProvider)
  const payoutsByProvider = useShopStore((s) => s.payoutsByProvider)
  const [filterProvider, setFilterProvider] = useState('all')

  const rows = []
  for (const p of providers) {
    if (filterProvider !== 'all' && filterProvider !== p.id) continue
    for (const e of earningsByProvider[p.id] || []) rows.push({ ...e, kind: 'earning', providerName: p.name })
    for (const pay of payoutsByProvider[p.id] || []) rows.push({ ...pay, kind: 'payout', providerName: p.name })
  }
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', fontSize: 20 }}>‹</button>
        <div style={{ fontSize: 20, fontWeight: 700 }}>History</div>
      </div>

      <select
        value={filterProvider}
        onChange={(e) => setFilterProvider(e.target.value)}
        style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #E0DEEB', marginBottom: 16 }}
      >
        <option value="all">All providers</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {rows.map((r) => (
        <div key={r.local_id} style={{
          display: 'flex', justifyContent: 'space-between', background: '#fff',
          border: '1px solid #F0EEF7', borderRadius: 14, padding: 14, marginBottom: 8,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {r.providerName} · {r.kind === 'earning' ? (r.note || 'Earning') : `Payout (${r.method})`}
            </div>
            <div style={{ fontSize: 12, color: '#8A8A9A' }}>{new Date(r.created_at).toLocaleString()}</div>
          </div>
          <div style={{ fontWeight: 700, color: r.kind === 'earning' ? '#2FA866' : '#D9822B' }}>
            {r.kind === 'earning' ? '+' : '-'}KES {Number(r.amount).toLocaleString()}
          </div>
        </div>
      ))}

      {rows.length === 0 && (
        <div style={{ color: '#8A8A9A', textAlign: 'center', marginTop: 40 }}>No history yet.</div>
      )}
    </div>
  )
}
