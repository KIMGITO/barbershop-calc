import { useNetworkStore } from '../store/useNetworkStore'
import { WifiOff, RefreshCw, CircleAlert, CloudUpload } from 'lucide-react'
import { status, type } from '../theme'

export default function NetworkBanner() {
  const { isOnline, isSyncing, pendingCount, lastError } = useNetworkStore()

  if (isOnline && pendingCount === 0 && !lastError) return null

  let text = ''
  let tone = 'pending'
  let Icon = CloudUpload

  if (!isOnline) {
    Icon = WifiOff
    text = pendingCount > 0
      ? `Offline · ${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync`
      : 'Offline · changes are saved on this device'
  } else if (isSyncing) {
    tone = 'info'
    Icon = RefreshCw
    text = 'Syncing…'
  } else if (lastError) {
    tone = 'danger'
    Icon = CircleAlert
    text = 'Syncing failed, retrying…'
  } else if (pendingCount > 0) {
    text = `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync`
  }

  if (!text) return null
  const s = status[tone] || status.pending

  return (
    <div
      // Announced politely: a sync hiccup shouldn't interrupt a screen reader.
      role="status"
      aria-live="polite"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        background: s.bg, color: s.fg,
        ...type.meta, fontWeight: 600,
        padding: '7px 12px',
      }}
    >
      <Icon size={14} strokeWidth={2.4} aria-hidden style={isSyncing ? { animation: 'spin 1.2s linear infinite' } : undefined} />
      {text}
    </div>
  )
}
