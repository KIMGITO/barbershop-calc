import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/providers', label: 'Team', icon: '👤' },
  { to: '/services', label: 'Services', icon: '✂' },
  { to: '/dashboard', label: 'Totals', icon: '📊' },
  { to: '/history', label: 'History', icon: '🕓' },
]

// Fixed to the bottom, floats above content (screens already reserve
// ~90-100px of bottom padding so nothing sits under it), and respects the
// device's safe-area inset so it never overlaps a phone's gesture bar.
export default function BottomNav() {
  return (
    <nav
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        background: '#1A1A2E',
        borderRadius: 20,
        padding: '10px 6px',
        boxShadow: '0 8px 24px rgba(26,26,46,0.25)',
        zIndex: 100,
      }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            textDecoration: 'none',
            color: isActive ? '#fff' : '#8A8AA0',
            padding: '4px 10px',
            borderRadius: 12,
            background: isActive ? '#7C5CFC' : 'transparent',
            minWidth: 52,
          })}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>{tab.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 600 }}>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
