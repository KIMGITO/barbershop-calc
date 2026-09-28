import { Clock, CircleCheck, CircleX, X } from 'lucide-react'
import { status, type } from '../theme'

// Tones are semantic, not decorative: amber = waiting, green = approved,
// red = rejected, grey = cancelled. See theme > status.
const STYLES = {
  pending:   { tone: 'pending', label: 'Waiting for approval', icon: Clock },
  approved:  { tone: 'success', label: 'Approved', icon: CircleCheck },
  rejected:  { tone: 'danger',  label: 'Rejected', icon: CircleX },
  cancelled: { tone: 'neutral', label: 'Cancelled', icon: X },
}

export default function RequestStatus({ status: value }) {
  const s = STYLES[value] || STYLES.pending
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: status[s.tone].bg, color: status[s.tone].fg,
        borderRadius: 999, padding: '3px 9px',
        ...type.metaSm, fontWeight: 700,
      }}
    >
      <s.icon size={12} strokeWidth={2.75} aria-hidden />
      {s.label}
    </span>
  )
}
