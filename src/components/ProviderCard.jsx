import { useNavigate } from 'react-router-dom'

export default function ProviderCard({ provider, todayTotal }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/provider/${provider.id}`)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        background: '#fff',
        border: '1px solid #F0EEF7',
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
        textAlign: 'left',
      }}
    >
      <img
        src={provider.photo_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + provider.name}
        alt={provider.name}
        style={{ width: 48, height: 48, borderRadius: 14, objectFit: 'cover', background: '#eee' }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E' }}>{provider.name}</div>
        <div style={{ fontSize: 12, color: '#8A8A9A' }}>{provider.role_title}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: '#8A8A9A' }}>Today</div>
        <div style={{ fontWeight: 700, color: '#7C5CFC' }}>KES {Number(todayTotal || 0).toLocaleString()}</div>
      </div>
    </button>
  )
}
