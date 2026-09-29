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

  // Dynamic layout adjustment based on tab density (3 items vs 5 items)
  const isCompact = tabs.length <= 3;

  return (
    <nav
      aria-label="Main"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isCompact ? 6 : 2,
        width: 'fit-content',
        maxWidth: 'calc(100vw - 24px)',
        background: surface.nav,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.pill,
        padding: '5px 6px',
        boxShadow: shadow.pop,
        zIndex: 100,
        transform: hidden
          ? 'translate(-50%, calc(100% + 40px))'
          : 'translate(-50%, 0)',
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
        transition:
          'transform 250ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
      }}
    >
      {tabs.map((tab) => {
        const active = isActiveIcon(tab, pathname);
        const badgeCount = badges[tab.to] || 0;

        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            style={() => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              textDecoration: 'none',
              color: active ? primaryDeep : ink.muted,
              padding: isCompact ? '6px 16px' : '5px 10px',
              borderRadius: radius.pill,
              background: active ? surface.wash : 'transparent',
              minWidth: isCompact ? 58 : 46,
              position: 'relative',
              transition:
                'background 180ms ease, color 180ms ease, transform 150ms ease',
            })}
          >
            {badgeCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: isCompact ? 10 : 4,
                  minWidth: 15,
                  height: 15,
                  borderRadius: radius.pill,
                  background: status.danger.solid,
                  color: brand.white,
                  ...type.metaSm,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  fontSize: 9,
                  border: `2px solid ${surface.nav}`,
                }}
              >
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
            <tab.icon
              size={isCompact ? 19 : 18}
              strokeWidth={active ? 2.5 : 1.8}
              aria-hidden
            />
          
          </NavLink>
        );
      })}
    </nav>
  );
}

function isActiveIcon(tab, pathname) {
  return tab.end ? pathname === tab.to : pathname.startsWith(tab.to);
}
