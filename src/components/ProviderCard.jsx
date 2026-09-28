import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { ink, line, shadow, surface, type, radius, primaryDeep } from '../theme'

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
        padding: 12,
        marginBottom: 10,
        textAlign: 'left',
        boxShadow: shadow.card,
      }}
    >
      <img
        src={provider.photo_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + provider.name}
        alt=""
        style={{ width: 48, height: 48, borderRadius: radius.md, objectFit: 'cover', background: surface.subtle }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 14px bold — the brand's "username" size, used for people's names. */}
        <div style={{ ...type.handle, color: ink.strong, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{provider.name}</div>
        <div style={{ ...type.meta, color: ink.muted }}>{provider.role_title || 'Service provider'}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ ...type.metaSm, color: ink.muted }}>Today</div>
        <div className="tnum" style={{ ...type.handle, color: primaryDeep }}>KES {Number(todayTotal || 0).toLocaleString()}</div>
      </div>
      <ChevronRight size={18} color={ink.faint} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0 }} />
    </button>
  )
}
