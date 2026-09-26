import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShopStore } from '../store/useShopStore'
import ProviderCard from '../components/ProviderCard'

export default function ProviderList() {
  const navigate = useNavigate()
  const shopId = useShopStore((s) => s.shopId)
  const providers = useShopStore((s) => s.providers)
  const loadProviders = useShopStore((s) => s.loadProviders)
  const loadProviderLogs = useShopStore((s) => s.loadProviderLogs)
  const providerSummary = useShopStore((s) => s.providerSummary)

  useEffect(() => {
    if (!shopId) return
    loadProviders(shopId).then((list) => {
      list.forEach((p) => loadProviderLogs(p.id))
    })
  }, [shopId])

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Service Providers</div>
        <button
          onClick={() => navigate('/add-provider')}
          style={{ background: '#7C5CFC', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 600, fontSize: 12 }}
        >
          + Add Provider
        </button>
      </div>

      {providers.map((p) => (
        <ProviderCard key={p.id} provider={p} todayTotal={providerSummary(p.id).earned.today} />
      ))}

      {providers.length === 0 && (
        <div style={{ color: '#8A8A9A', textAlign: 'center', marginTop: 40 }}>
          No providers yet. Add one to get started.
        </div>
      )}
    </div>
  )
}
