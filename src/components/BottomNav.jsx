import { NavLink, useLocation } from 'react-router-dom';
import {
  House,
  Users,
  Scissors,
  ClipboardCheck,
  History,
  Plus,
} from 'lucide-react';
import { useHideOnScroll } from '../hooks/useHideOnScroll';
import {
  brand,
  ink,
  line,
  surface,
  type,
  radius,
  shadow,
  primaryDeep,
  status,
} from '../theme';

export const OWNER_TABS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/providers', label: 'Team', icon: Users },
  { to: '/services', label: 'Services', icon: Scissors },
  { to: '/requests', label: 'Approvals', icon: ClipboardCheck },
  { to: '/history', label: 'History', icon: History },
];

export function providerTabs(canRecord) {
  return [
    { to: '/', label: 'Today', icon: House, end: true },
    ...(canRecord ? [{ to: '/record', label: 'Record', icon: Plus }] : []),
    { to: '/history', label: 'History', icon: History },
  ];
}

export default function BottomNav({ tabs = OWNER_TABS, badges = {} }) {
  const { pathname } = useLocation();
  const hidden = useHideOnScroll(pathname);

  return (
    <nav
      aria-label="Main"
      style={{
        position: 'fixed',
        left: 10,
        right: 10,
        bottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        display: 'grid', // 1. Switch from flex to grid
        gridAutoFlow: 'column', // 2. Arrange children in columns
        gridAutoColumns: '1fr', // 3. Make every column exactly the same fractional size (equal width)
        alignItems: 'center',
        background: surface.nav,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.xl,
        padding: '5px 4px',
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
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            textDecoration: 'none',
            color: isActive ? primaryDeep : ink.muted,
            padding: '4px 6px',
            borderRadius: radius.md,
            background: isActive ? surface.wash : 'transparent',
            minWidth: 48,
            position: 'relative',
            transition: 'background 150ms ease, color 150ms ease',
          })}
        >
          {badges[tab.to] > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: 4,
                minWidth: 16,
                height: 16,
                borderRadius: 999,
                background: status.danger.solid,
                color: brand.white,
                ...type.metaSm,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                fontSize: 10,
                border: `2px solid ${surface.nav}`,
              }}
            >
              {badges[tab.to] > 9 ? '9+' : badges[tab.to]}
            </span>
          )}
          <tab.icon
            size={18}
            strokeWidth={isActiveIcon(tab, pathname) ? 2.5 : 2}
            aria-hidden
          />
          <span
            style={{
              ...type.tab,
              fontWeight: isActiveIcon(tab, pathname) ? 700 : 500,
            }}
          >
            {tab.label}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}

function isActiveIcon(tab, pathname) {
  return tab.end ? pathname === tab.to : pathname.startsWith(tab.to);
}
