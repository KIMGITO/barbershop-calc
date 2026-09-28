import { NavLink, useLocation } from 'react-router-dom'
import { House, Users, Scissors, ClipboardCheck, History, Plus } from 'lucide-react'
import { useHideOnScroll } from '../hooks/useHideOnScroll'
import { brand, ink, line, surface, type, radius, shadow, primaryDeep, status } from '../theme'

// `icon` is a lucide component, rendered at 20px.
export const OWNER_TABS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/providers', label: 'Team', icon: Users },
  { to: '/services', label: 'Services', icon: Scissors },
  { to: '/requests', label: 'Approvals', icon: ClipboardCheck },
  { to: '/history', label: 'History', icon: History },
]

// Providers only see the Record tab when the admin has allowed it.
export function providerTabs(canRecord) {
  return [
    { to: '/', label: 'Today', icon: House, end: true },
    ...(canRecord ? [{ to: '/record', label: 'Record', icon: Plus }] : []),
    { to: '/history', label: 'History', icon: History },
  ]
}

// Floating bottom nav. Slides away when scrolling down, returns when
// scrolling up (or on reaching the top/bottom, or navigating).
// `badges`: { [path]: count } shows a small count bubble on that tab.
export default function BottomNav({ tabs = OWNER_TABS, badges = {} }) {
  const { pathname } = useLocation()
  const hidden = useHideOnScroll(pathname)

  return (
    <nav
      aria-label="Main"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        background: surface.nav,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.xl,
        padding: '8px 6px',
        boxShadow: shadow.nav,
        zIndex: 100,
        transform: hidden ? 'translateY(calc(100% + 40px))' : 'translateY(0)',
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
        transition: 'transform 250ms ease, opacity 250ms ease',
      }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          style={({ isActive }) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            textDecoration: 'none',
            color: isActive ? primaryDeep : ink.muted,
            padding: '6px 10px', borderRadius: radius.md,
            background: isActive ? surface.wash : 'transparent',
            minWidth: 56, position: 'relative',
            transition: 'background 150ms ease, color 150ms ease',
          })}
        >
          {badges[tab.to] > 0 && (
            <span style={{
              position: 'absolute', top: -1, right: 6, minWidth: 17, height: 17, borderRadius: 999,
              background: status.danger.solid, color: brand.white, ...type.metaSm, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              border: `2px solid ${surface.nav}`,
            }}>{badges[tab.to] > 9 ? '9+' : badges[tab.to]}</span>
          )}
          <tab.icon size={20} strokeWidth={isActiveIcon(tab, pathname) ? 2.5 : 2} aria-hidden />
          <span style={{ ...type.tab, fontWeight: isActiveIcon(tab, pathname) ? 700 : 500 }}>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function isActiveIcon(tab, pathname) {
  return tab.end ? pathname === tab.to : pathname.startsWith(tab.to)
}

