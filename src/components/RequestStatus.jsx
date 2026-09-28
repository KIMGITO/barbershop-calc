const STYLES = {
  pending: { bg: '#FFF3E6', color: '#D9822B', label: 'Waiting for approval' },
  approved: { bg: '#EAF7EF', color: '#2FA866', label: 'Approved' },
  rejected: { bg: '#FDECEC', color: '#D9482B', label: 'Rejected' },
  cancelled: { bg: '#EFEFF4', color: '#8A8A9A', label: 'Cancelled' },
}

export default function RequestStatus({ status }) {
  const s = STYLES[status] || STYLES.pending
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  )
}
