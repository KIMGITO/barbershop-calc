import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Users } from 'lucide-react'
import { useShopStore } from '../store/useShopStore'
import ProviderCard from '../components/ProviderCard'
import { Button, EmptyState } from '../components/ui'
import { ink, type } from '../theme'

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
        <div style={{ ...type.screen, color: ink.strong }}>Service Providers</div>
        <Button size="sm" icon={UserPlus} onClick={() => navigate('/add-provider')}>
          Add Provider
        </Button>
      </div>

      {providers.map((p) => (
        <ProviderCard key={p.id} provider={p} todayTotal={providerSummary(p.id).earned.today} />
      ))}

      {providers.length === 0 && (
        <EmptyState icon={Users}>
          No providers yet. Add one to get started.
        </EmptyState>
      )}
    </div>
  )
}
