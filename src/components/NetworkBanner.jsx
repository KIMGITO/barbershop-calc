import { useNetworkStore } from '../store/useNetworkStore'

export default function NetworkBanner() {
  const { isOnline, isSyncing, pendingCount, lastError } = useNetworkStore()

  if (isOnline && pendingCount === 0 && !lastError) return null

  let text = ''
  let bg = '#FBF3D9'
  let color = '#8A6D00'

  if (!isOnline) {
    text = pendingCount > 0
      ? `Offline · ${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync`
      : 'Offline · changes are saved on this device'
  } else if (isSyncing) {
    text = 'Syncing…'
    bg = '#E8F0FE'; color = '#1A56DB'
  } else if (lastError) {
    text = `Sync issue — will retry automatically`
    bg = '#FCE8E6'; color = '#B3261E'
  } else if (pendingCount > 0) {
    text = `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync`
  }

  if (!text) return null

  return (
    <div style={{
      background: bg, color, fontSize: 12, fontWeight: 600,
      textAlign: 'center', padding: '6px 10px',
    }}>
      {text}
    </div>
  )
}
