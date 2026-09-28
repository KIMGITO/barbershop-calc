import ActivityItem from './ActivityItem'
import { groupByDay, totals, money } from '../utils/activity'

export default function ActivityFeed({ items, showProvider = true, emptyText = 'Nothing here yet.', grouped = true }) {
  if (items.length === 0) {
    return <div style={{ color: '#8A8A9A', textAlign: 'center', padding: '28px 0', fontSize: 13 }}>{emptyText}</div>
  }
  if (!grouped) {
    return items.map((a) => <ActivityItem key={a.key} a={a} showProvider={showProvider} />)
  }
  return groupByDay(items).map((g) => (
    <div key={g.label} style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8A8A9A', fontWeight: 600, margin: '14px 2px 8px' }}>
        <span>{g.label}</span>
        <span>{money(totals(g.items).earned)} earned</span>
      </div>
      {g.items.map((a) => <ActivityItem key={a.key} a={a} showProvider={showProvider} />)}
    </div>
  ))
}
