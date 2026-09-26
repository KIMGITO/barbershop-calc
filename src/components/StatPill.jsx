export default function StatPill({ label, value, accent }) {
  return (
    <div style={{
      flex: 1,
      background: '#F7F5FC',
      borderRadius: 14,
      padding: '12px 10px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: '#8A8A9A', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent || '#1A1A2E' }}>
        KES {Number(value).toLocaleString()}
      </div>
    </div>
  )
}
