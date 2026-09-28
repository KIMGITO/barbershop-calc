import { Receipt } from 'lucide-react'
import { ink, surface, type, radius } from '../theme'
import { EmptyState } from './ui'

import ActivityItem from './ActivityItem'
import { groupByDay, totals, money } from '../utils/activity'

export default function ActivityFeed({ items, showProvider = true, emptyText = 'Nothing here yet.', grouped = true }) {
  if (items.length === 0) {
    return <EmptyState icon={Receipt}>{emptyText}</EmptyState>
  }
  if (!grouped) {
    return items.map((a) => <ActivityItem key={a.key} a={a} showProvider={showProvider} />)
  }
  return groupByDay(items).map((g) => (
    <div key={g.label} style={{ marginBottom: 8 }}>
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          ...type.metaSm, color: ink.muted, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          background: surface.wash, borderRadius: radius.pill,
          padding: '6px 12px', margin: '16px 0 8px',
        }}
      >
        <span>{g.label}</span>
        <span className="tnum" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{money(totals(g.items).earned)}</span>
      </div>
      {g.items.map((a) => <ActivityItem key={a.key} a={a} showProvider={showProvider} />)}
    </div>
  ))
}
