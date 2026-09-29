import { useEffect } from 'react'
import { useShopStore } from '../store/useShopStore'
import { mergeActivities } from '../utils/activity'
import HistoryView from '../components/HistoryView'

// Admin audit history: every earning and payout across the whole team.
//
// The roster used here is the *full* one, removed providers included. Taking
// someone off the team must never take their earnings out of the audit trail, so
// their logs stay loaded and their name keeps resolving on every row they own.
export default function History() {
  const shopId = useShopStore((s) => s.shopId)
  const providers = useShopStore((s) => s.allProviders)
  const earningsByProvider = useShopStore((s) => s.earningsByProvider)
  const payoutsByProvider = useShopStore((s) => s.payoutsByProvider)
  const pulling = useShopStore((s) => s.pulling)
  const loadProviders = useShopStore((s) => s.loadProviders)
  const loadProviderLogs = useShopStore((s) => s.loadProviderLogs)

  useEffect(() => {
    if (!shopId) return
    // loadProviders fills `allProviders`; read the roster back from the store
    // rather than using its (active-only) return value, so a removed provider's
    // records are loaded and shown too.
    loadProviders(shopId).then(() =>
      useShopStore.getState().allProviders.forEach((p) => loadProviderLogs(p.id)),
    )
  }, [shopId])

  const nameOf = (id) => providers.find((p) => p.id === id)?.name || ''
  const earnings = providers.flatMap((p) => earningsByProvider[p.id] || [])
  const payouts = providers.flatMap((p) => payoutsByProvider[p.id] || [])
  const activities = mergeActivities(earnings, payouts, nameOf)

  return <HistoryView activities={activities} providers={providers} loading={pulling} />
}
