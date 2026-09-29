import { Receipt } from 'lucide-react'
import { ink, line, surface, type, radius } from '../theme'
import { EmptyState } from './ui'
import ActivityItem from './ActivityItem'
import { groupByDay, totals, money } from '../utils/activity'

export default function ActivityFeed({ items, showProvider = true, emptyText = 'Nothing here yet.', grouped = true }) {
  if (items.length === 0) {
    return <EmptyState icon={Receipt}>{emptyText}</EmptyState>
  }

  if (!grouped) {
    return (
      <div style={{ background: surface.card, border: `1px solid ${line.hair}`, borderRadius: radius.lg, overflow: 'hidden' }}>
        {items.map((a, i) => (
          <ActivityItem key={a.key} a={a} showProvider={showProvider} isLast={i === items.length - 1} />
        ))}
      </div>
    )
  }

  return groupByDay(items).map((g) => (
    <div key={g.label} style={{ marginBottom: 12 }}>
      {/* Clean date divider header */}
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          ...type.metaSm, color: ink.muted, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          padding: '8px 4px 6px',
        }}
      >
        <span>{g.label}</span>
        <span className="tnum" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
          {money(totals(g.items).earned)}
        </span>
      </div>

      <div style={{ background: surface.card, border: `1px solid ${line.hair}`, borderRadius: radius.lg, overflow: 'hidden' }}>
        {g.items.map((a, i) => (
          <ActivityItem key={a.key} a={a} showProvider={showProvider} isLast={i === g.items.length - 1} />
        ))}
      </div>
    </div>
  ))
}
