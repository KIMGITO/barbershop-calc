import { useEffect } from 'react'
import { useShopStore } from '../store/useShopStore'
import { mergeActivities } from '../utils/activity'
import HistoryView from '../components/HistoryView'

// Admin audit history: every earning and payout across the whole team.
export default function History() {
  const shopId = useShopStore((s) => s.shopId)
  const providers = useShopStore((s) => s.providers)
  const earningsByProvider = useShopStore((s) => s.earningsByProvider)
  const payoutsByProvider = useShopStore((s) => s.payoutsByProvider)
  const pulling = useShopStore((s) => s.pulling)
  const loadProviders = useShopStore((s) => s.loadProviders)
  const loadProviderLogs = useShopStore((s) => s.loadProviderLogs)

  useEffect(() => {
    if (!shopId) return
    loadProviders(shopId).then((list) => list.forEach((p) => loadProviderLogs(p.id)))
  }, [shopId])

  const nameOf = (id) => providers.find((p) => p.id === id)?.name || ''
  const earnings = providers.flatMap((p) => earningsByProvider[p.id] || [])
  const payouts = providers.flatMap((p) => payoutsByProvider[p.id] || [])
  const activities = mergeActivities(earnings, payouts, nameOf)

  return <HistoryView activities={activities} providers={providers} loading={pulling} />
}
