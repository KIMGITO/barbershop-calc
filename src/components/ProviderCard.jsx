import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { ink, line, shadow, surface, type, radius, primaryDeep } from '../theme'
import Avatar from './Avatar'

export default function ProviderCard({ provider, todayTotal }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/provider/${provider.id}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%',
        background: surface.card,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.lg,
        padding: '10px 12px',
        marginBottom: 8,
        textAlign: 'left',
        boxShadow: shadow.card,
      }}
    >
      <Avatar
        src={provider.photo_url}
        name={provider.name}
        size={42}
        square
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...type.handle, color: ink.strong, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {provider.name}
        </div>
        <div style={{ ...type.meta, color: ink.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {provider.role_title || 'Service provider'}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 4 }}>
        <div style={{ ...type.metaSm, color: ink.muted }}>Today</div>
        <div className="tnum" style={{ ...type.handle, color: primaryDeep }}>
          KES {Number(todayTotal || 0).toLocaleString()}
        </div>
      </div>
      <ChevronRight size={16} color={ink.faint} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0 }} />
    </button>
  )
}
