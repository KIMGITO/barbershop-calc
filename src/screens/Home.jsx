import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'
import { useAuthStore } from '../store/useAuthStore'
import StatPill from '../components/StatPill'

export default function Home() {
  const navigate = useNavigate()
  const shopId = useShopStore((s) => s.shopId)
  const providers = useShopStore((s) => s.providers)
  const loadProviders = useShopStore((s) => s.loadProviders)
  const loadProviderLogs = useShopStore((s) => s.loadProviderLogs)
  const shopSummary = useShopStore((s) => s.shopSummary)
  const signOutOwner = useAuthStore((s) => s.signOutOwner)

  useEffect(() => {
    if (!shopId) return
    loadProviders(shopId).then((list) => list.forEach((p) => loadProviderLogs(p.id)))
  }, [shopId])

  const { earned, paid, owed } = shopSummary()

  const tiles = [
    { label: 'Providers', sub: `${providers.length} on the team`, path: '/providers', bg: '#F1EBFF', color: '#7C5CFC' },
    { label: 'Add Provider', sub: 'Onboard someone new', path: '/add-provider', bg: '#EAF7EF', color: '#2FA866' },
    { label: 'Services', sub: 'Manage your price list', path: '/services', bg: '#FFF3E6', color: '#D9822B' },
    { label: 'History', sub: 'Full earnings & payouts log', path: '/history', bg: '#EAF1FF', color: '#2E6BE0' },
  ]

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Barbershop</div>
        <button onClick={signOutOwner} style={{ background: 'none', border: 'none', color: '#8A8A9A', fontSize: 12 }}>
          Sign out
        </button>
      </div>
      <div style={{ color: '#8A8A9A', marginBottom: 16, fontSize: 13 }}>Today's overview</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <StatPill label="Total Earned" value={earned} />
        <StatPill label="Paid Out" value={paid} accent="#2FA866" />
        <StatPill label="Owed to Team" value={owed} accent="#D9822B" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {tiles.map((t) => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            style={{
              textAlign: 'left', border: 'none', borderRadius: 16, padding: 16,
              background: t.bg, minHeight: 84,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, color: t.color, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 12, color: '#6E6E82' }}>{t.sub}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
