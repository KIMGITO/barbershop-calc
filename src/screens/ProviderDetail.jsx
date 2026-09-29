import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShopStore } from '../store/useShopStore';
import { useAuthStore } from '../store/useAuthStore';
import { formatPhone, isValidPhone, normalizePhone, samePhone } from '../utils/phone';
import StatPill from '../components/StatPill';
import ActivityFeed from '../components/ActivityFeed';
import SelfRecordToggle from '../components/SelfRecordToggle';
import Avatar from '../components/Avatar';
import { liveActivities, mergeActivities } from '../utils/activity';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Pencil,
  Trash2,
  Plus,
  CheckLineIcon,
} from 'lucide-react';
import {
  ink,
  line,
  surface,
  type,
  radius,
  status,
  shadow,
  brand,
} from '../theme';
import {
  Button,
  IconButton,
  Screen,
  Card,
  Sheet,
  SheetBody,
  SheetFooter,
  Field,
  Input,
  ErrorText,
} from '../components/ui';

export default function ProviderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const role = useAuthStore((s) => s.role);
  const ownerPhone = useAuthStore((s) => s.shop?.owner_phone);

  const providers = useShopStore((s) => s.providers);
  const loadProviderLogs = useShopStore((s) => s.loadProviderLogs);
  const providerSummary = useShopStore((s) => s.providerSummary);
  const earnings = useShopStore((s) => s.earningsByProvider[id] || []);
  const payouts = useShopStore((s) => s.payoutsByProvider[id] || []);
  const updateProvider = useShopStore((s) => s.updateProvider);
  const deleteProvider = useShopStore((s) => s.deleteProvider);

  const provider = providers.find((p) => p.id === id);

  // Sheet states
  const [sheet, setSheet] = useState(null); // null | 'edit' | 'delete'
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) loadProviderLogs(id);
  }, [id, loadProviderLogs]);

  if (!provider) return null;

  const isOwner = role === 'owner';
  // Same number, any format — the admin typed it once as 07…, the roster may
  // hold it as +254…, and both mean "this is me".
  const isSelf = samePhone(provider.phone, ownerPhone);
  const { earned, paid, owed } = providerSummary(id);
  // The Activity Log is an activity surface, not the audit trail: a record the
  // owner removed leaves it. It is still in History, struck through and marked
  // "Deleted" (see liveActivities).
  const feed = liveActivities(
    mergeActivities(earnings, payouts, () => provider.name),
  );

  const closeSheet = () => {
    setSheet(null);
    setDraft(null);
    setError('');
  };

  const openEdit = () => {
    setError('');
    setDraft({
      name: provider.name || '',
      phone: provider.phone || '',
      roleTitle: provider.role_title || '',
      canSelfRecord: !!provider.can_self_record,
    });
    setSheet('edit');
  };

  const openDelete = () => {
    setError('');
    setSheet('delete');
  };

  async function handleSaveEdit() {
    if (!draft.name.trim()) return setError('A provider needs a name.');
    if (!draft.phone.trim()) return setError('Phone number cannot be empty.');
    // Any format is accepted — 07…, 01…, 254…, +254… — because the store
    // normalizes before writing. Something that isn't a dialable number is
    // refused here rather than queued and rejected by the server later.
    if (!isValidPhone(draft.phone))
      return setError('Enter a valid phone number, e.g. 0712 345 678.');

    setBusy(true);
    setError('');
    try {
      await updateProvider({
        id: provider.id,
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        roleTitle: draft.roleTitle.trim(),
        canSelfRecord: draft.canSelfRecord,
      });
      closeSheet();
    } catch (e) {
      setError(e?.message || 'Could not update provider.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError('');
    try {
      await deleteProvider(provider.id);
      closeSheet();
      navigate(-1);
    } catch (e) {
      setError(e?.message || 'Could not delete provider.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconButton
            icon={ArrowLeft}
            label="Go back"
            onClick={() => navigate(-1)}
            size={30}
          />
          <h1 style={{ ...type.screen, color: ink.strong, margin: 0 }}>
            Provider Details
          </h1>
        </div>

        {/* Header Actions */}
        {isOwner && !isSelf && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconButton
              icon={Pencil}
              size={28}
              variant="soft"
              label="Edit provider"
              onClick={openEdit}
            />
            <IconButton
              icon={Trash2}
              size={28}
              variant="ghost"
              label="Delete provider"
              style={{ color: status.danger.fg }}
              onClick={openDelete}
            />
          </div>
        )}
      </div>

      {/* Main Profile Hero Card */}
      <Card
        style={{
          marginBottom: 16,
          padding: 16,
          boxShadow: shadow.card,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minWidth: 0,
            }}
          >
            <Avatar src={provider.photo_url} name={provider.name} size={52} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  ...type.name,
                  color: ink.strong,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textTransform: 'capitalize',
                }}
              >
                {provider.name}
              </div>
              <div style={{ ...type.meta, color: ink.muted, marginTop: 2 }}>
                {provider.role_title || 'Provider'} · {formatPhone(provider.phone)}
              </div>
            </div>
          </div>

          {/* Owed Balance Spotlight */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ ...type.metaSm, color: ink.muted }}>Owed</div>
            <div
              className="tnum"
              style={{
                ...type.amount,
                color: owed > 0 ? status.pending.fg : status.success.fg,
              }}
            >
              KES {owed.toLocaleString()}
            </div>
          </div>
        </div>

        {!isSelf && (
          <div
            style={{
              marginBottom: 14,
              paddingTop: 12,
              borderTop: `1px dashed ${line.soft}`,
            }}
          >
            <SelfRecordToggle provider={provider} />
          </div>
        )}

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="sm"
            icon={Plus}
            onClick={() => navigate(`/provider/${id}/add-earning`)}
            style={{
              background: status.success.solid,
              borderColor: status.success.solid,
              flex: 1,
            }}
          >
            Add Earning
          </Button>
          <Button
            size="sm"
            variant="soft"
            icon={CheckLineIcon}
            onClick={() => navigate(`/provider/${id}/add-payout`)}
            style={{ flex: 1 }}
          >
            Add Payout
          </Button>
        </div>
      </Card>

      {/* Financial Overview Section */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            ...type.metaSm,
            color: ink.muted,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Earnings Breakdown
        </div>

        {/* Period Totals Row */}
        <Card style={{}}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {/* Left: Featured "Today" pill */}
            <div style={{ flex: 1, display: 'flex' }}>
              <StatPill
                label="This Month"
                value={earned.month}
                style={{ flex: 1, height: '100%' }}
                big
              />
            </div>

            {/* Right: Stacked "This Week" & "This Month" pills */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <StatPill
                label="This Week"
                value={earned.week}
                style={{ flex: 1 }}
              />
              <StatPill
                label="Earned Today "
                value={earned.today}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          {/* All-time Summary Matrix */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 2fr',
              gap: 6,
              background: surface.card,
              borderRadius: radius.lg,
              padding: '6px 8px',
              border: `1px solid ${line.hair}`,
            }}
          >
            <div>
              <div style={{ ...type.metaSm, color: ink.muted }}>All-Time</div>
              <div
                className="tnum"
                style={{ ...type.handle, color: ink.strong, marginTop: 2 }}
              >
                KES {earned.all.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ ...type.metaSm, color: ink.muted }}>Paid Out</div>
              <div
                className="tnum"
                style={{ ...type.handle, color: ink.strong, marginTop: 2 }}
              >
                KES {paid.all.toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...type.metaSm, color: ink.muted }}>Balance</div>
              <div
                className="tnum"
                style={{
                  ...type.handle,
                  color: owed > 0 ? status.pending.fg : status.success.fg,
                  marginTop: 2,
                }}
              >
                KES {owed.toLocaleString()}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Activity Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div style={{ ...type.handle, color: ink.strong }}>Activity Log</div>
        <div
          style={{
            ...type.metaSm,
            color: ink.muted,
            background: surface.subtle,
            padding: '2px 8px',
            borderRadius: radius.pill,
            border: `1px solid ${line.hair}`,
          }}
        >
          {feed.length} {feed.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      <ActivityFeed
        items={feed}
        showProvider={false}
        emptyText="No records created yet."
      />

      {/* Edit Provider Sheet */}
      <Sheet
        visible={sheet === 'edit'}
        onClose={closeSheet}
        title="Edit provider"
      >
        {draft && (
          <>
            <SheetBody>
              <Field label="Name" id="edit-pv-name">
                <Input
                  id="edit-pv-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. James"
                />
              </Field>
              <Field
                label="Phone number"
                id="edit-pv-phone"
                hint={
                  isValidPhone(draft.phone)
                    ? `Any format works — saved as ${normalizePhone(draft.phone)}.`
                    : 'They claim their device with this number.'
                }
              >
                <Input
                  id="edit-pv-phone"
                  type="tel"
                  inputMode="tel"
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value })
                  }
                  placeholder="07XX XXX XXX"
                />
              </Field>
              <Field
                label="Role"
                id="edit-pv-role"
                hint=" Shown under their name."
              >
                <Input
                  id="edit-pv-role"
                  value={draft.roleTitle}
                  onChange={(e) =>
                    setDraft({ ...draft, roleTitle: e.target.value })
                  }
                  placeholder="e.g. Senior barber"
                />
              </Field>
              <Switch
                on={draft.canSelfRecord}
                onToggle={() =>
                  setDraft({ ...draft, canSelfRecord: !draft.canSelfRecord })
                }
                label="Let them record their own services"
                hint={
                  draft.canSelfRecord
                    ? 'On records reach you for approval first.'
                    : 'Off only you can add earnings for them.'
                }
              />
              <ErrorText>{error}</ErrorText>
            </SheetBody>
            <SheetFooter>
              <Button
                size="sm"
                full
                variant="ghost"
                onClick={closeSheet}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button size="sm" full disabled={busy} onClick={handleSaveEdit}>
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            </SheetFooter>
          </>
        )}
      </Sheet>

      {/* Delete Provider Confirmation Sheet */}
      <Sheet
        visible={sheet === 'delete'}
        onClose={closeSheet}
        title={`Delete ${provider.name}`}
      >
        <SheetBody>
          <div style={{ ...type.metaSm, color: ink.muted, marginBottom: 12 }}>
            They will leave the team list, and no new earnings or payouts can be
            recorded against them. Their existing history is kept.
          </div>
          <ErrorText>{error}</ErrorText>
        </SheetBody>
        <SheetFooter>
          <Button
            size="sm"
            full
            variant="ghost"
            onClick={closeSheet}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            full
            variant="danger"
            onClick={handleDelete}
            disabled={busy}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
        </SheetFooter>
      </Sheet>
    </Screen>
  );
}

/** Inline Switch Component */
function Switch({ on, onToggle, label, hint }) {
  return (
    <div
      style={{
        background: surface.subtle,
        border: `1px solid ${line.hair}`,
        borderRadius: radius.md,
        padding: '8px 12px',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ ...type.metaSm, color: ink.strong, fontWeight: 600 }}>
            {label}
          </div>
          {hint && (
            <div
              style={{
                ...type.metaSm,
                color: ink.muted,
                marginTop: 1,
                fontSize: 9,
              }}
            >
              {hint}
            </div>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          onClick={onToggle}
          style={{
            width: 36,
            height: 20,
            borderRadius: radius.pill,
            border: 'none',
            padding: 2,
            flexShrink: 0,
            background: on ? brand.primary : line.hair,
            display: 'flex',
            alignItems: 'center',
            transition: 'background 150ms ease',
            cursor: 'pointer',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: brand.white,
              transform: on ? 'translateX(16px)' : 'translateX(0)',
              transition: 'transform 150ms ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            }}
          />
        </button>
      </div>
    </div>
  );
}
