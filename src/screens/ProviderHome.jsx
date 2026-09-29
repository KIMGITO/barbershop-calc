import { useNavigate } from 'react-router-dom';
import { useProviderStore } from '../store/useProviderStore';
import { periodTotals } from '../utils/dates';
import {
  mergeActivities,
  isToday,
  liveActivities,
  money,
} from '../utils/activity';
import StatPill from '../components/StatPill';
import ActivityFeed from '../components/ActivityFeed';
import Avatar from '../components/Avatar';
import { Screen, ErrorText } from '../components/ui';
import { Plus, Clock, LogOut } from 'lucide-react';
import {
  brand,
  shadow,
  surface,
  type,
  radius,
  status,
  primaryDeep,
  ink,
  line,
} from '../theme';
import { useAuthStore } from '../store/useAuthStore';

export default function ProviderHome() {
  const navigate = useNavigate();
  const signOut = useAuthStore((s) => s.signOut);
  const { provider, earnings, payouts, requests, loading, error } =
    useProviderStore();

  if (loading)
    return (
      <div style={{ padding: 20, ...type.body, color: 'inherit' }}>
        Loading…
      </div>
    );
  if (!provider) {
    return (
      <div style={{ padding: 20 }}>
        <ErrorText>
          {error ||
            'Your account could not be loaded. Ask the owner to check your number.'}
        </ErrorText>
      </div>
    );
  }

  const earned = periodTotals(earnings);
  const paid = periodTotals(payouts);
  const owed = earned.all - paid.all;
  const waiting = requests.filter((r) => r.status === 'pending').length;
  // An activity surface: a record the owner removed is gone from here, and only
  // History keeps it, struck through and marked "Deleted" (see liveActivities).
  const today = liveActivities(
    mergeActivities(earnings, payouts, () => provider.name).filter(isToday),
  );

  return (
    <Screen>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'end',
          padding: '0 0 12px 0',
        }}
      >
        <button
          onClick={signOut}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            color: ink.muted,
            ...type.metaSm,
            fontWeight: 600,
            padding: '4px 6px',
          }}
        >
          <LogOut size={14} strokeWidth={2.2} aria-hidden />
          Sign out
        </button>
      </div>

      <div
        style={{
          background: 'var(--gradient-dark-warm)',
          color: brand.white,
          borderRadius: radius.xl,
          padding: '16px',
          marginBottom: 12,
          boxShadow: shadow.glow,
        }}
      >
        {/* Top Row: Profile (Left) + Main Balance (Right) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
          }}
        >
          {/* Left: Avatar & Name */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 0,
            }}
          >
            <Avatar
              src={provider.photo_url}
              name={provider.name}
              size={44}
              square
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  ...type.name,
                  color: brand.white,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textTransform: 'capitalize',
                }}
              >
                {provider.name.split(' ')[0]}
              </div>
              <div style={{ ...type.meta, opacity: 0.85, marginTop: 2 }}>
                {provider.role_title || 'Service provider'}
              </div>
            </div>
          </div>

          {/* Right: Owed Amount Spotlight */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ ...type.metaSm, opacity: 0.85 }}>
              {owed >= 0 ? 'Owed to you' : 'Paid ahead'}
            </div>
            <div
              className="tnum"
              style={{
                ...type.display,
                fontSize: 22,
                lineHeight: 1.1,
                margin: '2px 0 0',
                color: brand.white,
              }}
            >
              {money(Math.abs(owed))}
            </div>
          </div>
        </div>

        {/* Bottom Row: Breakdown Totals Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 10,
            borderTop: '1px solid rgba(255, 255, 255, 0.15)',
            ...type.metaSm,
            opacity: 0.9,
          }}
        >
          <div>
            Earned: <strong>{money(earned.all)}</strong>
          </div>
          <div>
            Paid: <strong>{money(paid.all)}</strong>
          </div>
        </div>
      </div>

      {provider.can_self_record && (
        <button
          onClick={() => navigate('/record')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: surface.card,
            color: primaryDeep,
            border: `1px solid ${brand.mid}`,
            borderRadius: radius.lg,
            padding: '10px 12px',
            marginBottom: 12,
            textAlign: 'left',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.sm,
              flexShrink: 0,
              background: surface.wash,
              color: primaryDeep,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={18} strokeWidth={2.6} />
          </span>
          <span style={{ ...type.body, fontWeight: 600, flex: 1, minWidth: 0 }}>
            Record a service
          </span>
          {waiting > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: status.pending.fg,
                ...type.metaSm,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              <Clock size={12} strokeWidth={2.5} aria-hidden />
              {waiting} waiting
            </span>
          )}
        </button>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <StatPill label="Today" value={earned.today} />
        <StatPill label="This week" value={earned.week} />
        <StatPill label="This month" value={earned.month} />
      </div>

      <div style={{ ...type.section, color: 'inherit', marginBottom: 6 }}>
        Today's activity ({today.length})
      </div>
      <ActivityFeed
        items={today}
        showProvider={false}
        grouped={false}
        emptyText="No activity yet today."
      />
    </Screen>
  );
}
