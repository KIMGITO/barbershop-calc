import { useProviderStore } from '../store/useProviderStore'
import { mergeActivities } from '../utils/activity'
import HistoryView from '../components/HistoryView'

export default function ProviderHistory() {
  const { provider, earnings, payouts } = useProviderStore()
  const activities = mergeActivities(earnings, payouts, () => provider?.name || '')
  return <HistoryView activities={activities} providers={[]} />
}
