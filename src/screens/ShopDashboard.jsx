import { useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'
import StatPill from '../components/StatPill'

export default function ShopDashboard() {
  const navigate = useNavigate()
  const providers = useShopStore((s) => s.providers)
  const providerSummary = useShopStore((s) => s.providerSummary)
  const shopSummary = useShopStore((s) => s.shopSummary)
  const { earned, paid, owed } = shopSummary()

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', fontSize: 20 }}>‹</button>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Shop Totals</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <StatPill label="Total Earned" value={earned} />
        <StatPill label="Total Paid Out" value={paid} accent="#2FA866" />
        <StatPill label="Owed to Team" value={owed} accent="#D9822B" />
      </div>

      <div style={{ fontWeight: 700, marginBottom: 10 }}>Per Provider</div>
      {providers.map((p) => {
        const s = providerSummary(p.id)
        return (
          <div key={p.id} style={{
            display: 'flex', justifyContent: 'space-between', background: '#fff',
            border: '1px solid #F0EEF7', borderRadius: 14, padding: 14, marginBottom: 8,
          }}>
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ textAlign: 'right', fontSize: 13 }}>
              <div>Earned: KES {s.earned.all.toLocaleString()}</div>
              <div style={{ color: s.owed > 0 ? '#D9822B' : '#2FA866' }}>
                Owed: KES {s.owed.toLocaleString()}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
