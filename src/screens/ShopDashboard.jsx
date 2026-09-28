import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import { useShopStore } from '../store/useShopStore'
import StatPill from '../components/StatPill'
import { Card, IconButton, SectionTitle, EmptyState } from '../components/ui'
import { ink, type, status } from '../theme'

export default function ShopDashboard() {
  const navigate = useNavigate()
  const providers = useShopStore((s) => s.providers)
  const providerSummary = useShopStore((s) => s.providerSummary)
  const shopSummary = useShopStore((s) => s.shopSummary)
  const { earned, paid, owed } = shopSummary()

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <IconButton icon={ArrowLeft} label="Go back" onClick={() => navigate(-1)} />
        <div style={{ ...type.screen, color: ink.strong }}>Shop Totals</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <StatPill label="Total Earned" value={earned} />
        <StatPill label="Paid Out" value={paid} accent={status.success.fg} />
        <StatPill label="Owed to Team" value={owed} accent={status.pending.fg} />
      </div>

      <SectionTitle>Per Provider</SectionTitle>
      {providers.map((p) => {
        const s = providerSummary(p.id)
        const owedTone = s.owed > 0 ? status.pending.fg : status.success.fg
        return (
          <Card key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <div style={{ ...type.handle, color: ink.strong }}>{p.name}</div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="tnum" style={{ ...type.meta, color: ink.soft }}>
                Earned {s.earned.all.toLocaleString()}
              </div>
              <div className="tnum" style={{ ...type.meta, color: owedTone, fontWeight: 700 }}>
                Owed {s.owed.toLocaleString()}
              </div>
            </div>
          </Card>
        )
      })}

      {providers.length === 0 && (
        <EmptyState icon={Users}>
          No providers yet, so there are no per-person totals to show.
        </EmptyState>
      )}
    </div>
  )
}
