import { ink, line, surface, type, radius } from '../theme'

export default function StatPill({ label, value, accent }) {
  return (
    <div
      style={{
        flex: 1, minWidth: 0,
        background: surface.card,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.lg,
        padding: '12px 10px',
        textAlign: 'center',
      }}
    >
      <div style={{ ...type.metaSm, color: ink.muted, marginBottom: 4 }}>{label}</div>
      <div className="tnum" style={{ ...type.amount, color: accent || ink.strong }}>
        KES {Number(value).toLocaleString()}
      </div>
    </div>
  )
}
