import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  UserPlus,
  Scissors,
  ChartNoAxesColumn,
  ChevronRight,
  LogOut,
  ClipboardCheck,
} from 'lucide-react';
import { useShopStore } from '../store/useShopStore';
import { useAuthStore } from '../store/useAuthStore';
import { mergeActivities, isToday, totals } from '../utils/activity';
import StatPill from '../components/StatPill';
import ActivityFeed from '../components/ActivityFeed';
import { Screen } from '../components/ui';
import {
  ink,
  line,
  surface,
  type,
  radius,
  status,
  primaryDeep,
  shadow,
} from '../theme';

export default function Home() {
  const navigate = useNavigate();
  const shopId = useShopStore((s) => s.shopId);
  const providers = useShopStore((s) => s.providers);
  const earningsByProvider = useShopStore((s) => s.earningsByProvider);
  const payoutsByProvider = useShopStore((s) => s.payoutsByProvider);
  const loadProviders = useShopStore((s) => s.loadProviders);
  const loadProviderLogs = useShopStore((s) => s.loadProviderLogs);
  const shopSummary = useShopStore((s) => s.shopSummary);
  const pulling = useShopStore((s) => s.pulling);
  const signOutOwner = useAuthStore((s) => s.signOutOwner);
  const shop = useAuthStore((s) => s.shop);
  const pending = useShopStore(
    (s) => s.requests.filter((r) => r.status === 'pending').length,
  );

  useEffect(() => {
    if (!shopId) return;
    loadProviders(shopId).then((list) =>
      list.forEach((p) => loadProviderLogs(p.id)),
    );
  }, [shopId]);

  const me = providers.find((p) => p.phone === shop?.owner_phone);

  const nameOf = (id) => providers.find((p) => p.id === id)?.name || '';
  const all = mergeActivities(
    providers.flatMap((p) => earningsByProvider[p.id] || []),
    providers.flatMap((p) => payoutsByProvider[p.id] || []),
    nameOf,
  );
  const today = all.filter(isToday);
  const day = totals(today);
  const { owed } = shopSummary();

  const quick = [
    ...(me
      ? [{ label: 'My earnings', path: `/provider/${me.id}`, icon: User }]
      : []),
    { label: 'Totals', path: '/dashboard', icon: ChartNoAxesColumn },
    { label: 'Add provider', path: '/add-provider', icon: UserPlus },
  ];

  return (
    <Screen>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 2,
        }}
      >
        <div style={{ ...type.screen, color: ink.strong }}>
          {shop?.name || 'Barbershop'}
        </div>
        <button
          onClick={signOutOwner}
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
      <div style={{ color: ink.muted, marginBottom: 12, ...type.meta }}>
        {new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
      </div>

      {pending > 0 && (
        <button
          onClick={() => navigate('/requests')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            textAlign: 'left',
            background: status.pending.bg,
            color: status.pending.fg,
            border: 'none',
            borderRadius: radius.lg,
            padding: '10px 12px',
            fontWeight: 600,
            ...type.comment,
            marginBottom: 12,
            boxShadow: shadow.card,
          }}
        >
          <ClipboardCheck
            size={18}
            strokeWidth={2.3}
            aria-hidden
            style={{ flexShrink: 0 }}
          />
          <span style={{ flex: 1 }}>
            {pending} service {pending === 1 ? 'record is' : 'records are'}{' '}
            waiting for your approval
          </span>
          <ChevronRight
            size={16}
            strokeWidth={2.4}
            aria-hidden
            style={{ flexShrink: 0 }}
          />
        </button>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <div style={{ flex: 1, display: 'flex' }}>
          <StatPill
            label="Earned Today"
            value={day.earned}
            style={{ flex: 1, height: '100%' }}
            big
          />
        </div>

        {/* Column 2: Two equal rows (50% width) */}
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <StatPill
            label="Paid today"
            value={day.paid}
            accent={status.success.fg}
            style={{ flex: 1 }}
          />
          <StatPill
            label="Owed to team"
            value={owed}
            accent={status.pending.fg}
            style={{ flex: 1 }}
          />
        </div>
      </div>

      <div
        style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}
      >
        {quick.map((t) => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: `1px solid ${line.hair}`,
              borderRadius: radius.pill,
              padding: '7px 13px',
              background: surface.card,
              color: primaryDeep,
              fontWeight: 600,
              ...type.meta,
              whiteSpace: 'nowrap',
            }}
          >
            <t.icon size={14} strokeWidth={2.4} aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <div style={{ ...type.handle, color: ink.strong }}>
          Today's activity ({today.length})
        </div>
        <button
          onClick={() => navigate('/history')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            background: 'none',
            border: 'none',
            color: primaryDeep,
            ...type.metaSm,
            fontWeight: 600,
            padding: '4px 0',
            
          }}
          className='underline'
        >
          See history
        </button>
      </div>
      <ActivityFeed
        items={today}
        grouped={false}
        emptyText={
          pulling
            ? 'Restoring your history…'
            : 'No activity yet today. Open a provider to add an earning.'
        }
      />
    </Screen>
  );
}
