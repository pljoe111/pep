import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  campaignStatusVariant,
  campaignStatusLabel,
  verificationStatusVariant,
  verificationStatusLabel,
} from '../lib/badgeUtils';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Tabs } from '../components/ui/Tabs';
import { useToast } from '../hooks/useToast';
import {
  useAdminCampaigns,
  useAdminConfig,
  useAdminRefundCampaign,
  useAdminHideCampaign,
  useAdminVerifyCoa,
  useAdminFeeSweep,
  useAdminFlagCampaign,
  useAdminUpdateConfig,
  useAdminUsers,
  useAdminBanUser,
  useAdminManageClaim,
} from '../api/hooks/useAdmin';
import { useAuth } from '../hooks/useAuth';
import { formatUSD } from '../lib/formatters';
import { isValidSolanaAddress } from '../lib/validators';
import type { CampaignDetailDto, CoaDto } from 'api-client';

// COA verification modal
function VerifyCoaModal({
  coa,
  onClose,
}: {
  coa: CoaDto;
  onClose: () => void;
}): React.ReactElement {
  const [notes, setNotes] = useState('');
  const toast = useToast();
  const { mutateAsync: verifyCoa, isPending } = useAdminVerifyCoa();

  const handleVerify = async (status: 'approved' | 'rejected'): Promise<void> => {
    try {
      await verifyCoa({ id: coa.id, dto: { status, notes: notes || undefined } });
      toast.success(`COA ${status}`);
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to verify COA');
    }
  };

  return (
    <Modal isOpen title="Verify COA" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm font-medium text-text">{coa.file_name}</p>
        <a
          href={coa.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline block"
        >
          View PDF
        </a>
        <div>
          <label htmlFor="coa-notes" className="text-sm font-medium text-text block mb-1">
            Notes (optional)
          </label>
          <textarea
            id="coa-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="md"
            fullWidth
            loading={isPending}
            onClick={() => void handleVerify('rejected')}
          >
            Reject
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            loading={isPending}
            onClick={() => void handleVerify('approved')}
          >
            Approve
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Campaign row in admin table
function AdminCampaignRow({ campaign }: { campaign: CampaignDetailDto }): React.ReactElement {
  const toast = useToast();
  const [selectedCoa, setSelectedCoa] = useState<CoaDto | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { mutateAsync: refundCampaign, isPending: refundPending } = useAdminRefundCampaign();
  const { mutateAsync: hideCampaign, isPending: hidePending } = useAdminHideCampaign();
  const { mutateAsync: flagCampaign, isPending: flagPending } = useAdminFlagCampaign();

  const handleRefund = async (): Promise<void> => {
    if (!confirm('Force-refund this campaign? This cannot be undone.')) return;
    try {
      await refundCampaign({ id: campaign.id, dto: { reason: 'Admin force-refund' } });
      toast.success('Campaign refunded');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Refund failed');
    }
  };

  const isHidden = campaign.is_hidden;

  const handleHide = async (): Promise<void> => {
    try {
      await hideCampaign({ id: campaign.id, dto: { hidden: !isHidden } });
      toast.success(isHidden ? 'Campaign unhidden' : 'Campaign hidden');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to toggle visibility');
    }
  };

  const pendingCoas = (campaign.samples ?? [])
    .flatMap((s) => (s.coa ? [s.coa] : []))
    .filter(
      (c) => c.verification_status === 'pending' || c.verification_status === 'code_not_found'
    );

  return (
    <>
      <Card padding="md" className="mb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-text leading-tight mb-1">{campaign.title}</h4>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                aria-label={expanded ? 'Collapse details' : 'Expand details'}
                className="ml-1 p-1 rounded hover:bg-surface-a transition-colors"
                onClick={() => setExpanded((v) => !v)}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 8 10 12 14 8" />
                </svg>
              </button>
              <Badge variant={campaignStatusVariant(campaign.status)}>
                {campaignStatusLabel(campaign.status)}
              </Badge>
              {campaign.is_flagged_for_review && <Badge variant="amber">Flagged</Badge>}
            </div>
          </div>
          <p className="text-sm font-bold text-primary">
            {formatUSD(campaign.current_funding_usd)}
          </p>
        </div>
        <p className="text-xs text-text-2 mb-3">
          by {campaign.creator?.username ?? 'Unknown'} · {campaign.samples?.length ?? 0} samples
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="danger"
            size="sm"
            loading={refundPending}
            onClick={() => void handleRefund()}
          >
            Force Refund
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={hidePending}
            onClick={() => void handleHide()}
          >
            {isHidden ? 'Unhide' : 'Hide'}
          </Button>
          <Button
            variant={campaign.is_flagged_for_review ? 'secondary' : 'danger'}
            size="sm"
            loading={flagPending}
            onClick={() => {
              void (async () => {
                if (campaign.is_flagged_for_review) {
                  if (confirm('Mark as reviewed and clear flag?')) {
                    await flagCampaign({ id: campaign.id, dto: { flagged: false } });
                    toast.success('Campaign marked as reviewed');
                  }
                } else {
                  const reason = prompt('Reason for flagging (optional):') || undefined;
                  await flagCampaign({ id: campaign.id, dto: { flagged: true, reason } });
                  toast.success('Campaign flagged for review');
                }
              })();
            }}
          >
            {campaign.is_flagged_for_review ? 'Mark Reviewed' : 'Flag'}
          </Button>
        </div>
        {/* COA verification */}
        {pendingCoas.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs font-semibold text-text mb-2">Pending COAs:</p>
            {pendingCoas.map((coa) => (
              <div key={coa.id} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs text-text">{coa.file_name}</p>
                  <Badge variant={verificationStatusVariant(coa.verification_status)}>
                    {verificationStatusLabel(coa.verification_status)}
                  </Badge>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setSelectedCoa(coa)}>
                  Review
                </Button>
              </div>
            ))}
          </div>
        )}
        {expanded && (
          <div className="mt-3 p-3 rounded-xl bg-surface-a border border-border">
            <div className="mb-2">
              <span className="text-xs font-semibold text-text">Description:</span>
              <p className="text-xs text-text-2 whitespace-pre-line">
                {campaign.description || 'No description'}
              </p>
            </div>
            {campaign.flagged_reason && (
              <div className="mb-2">
                <span className="text-xs font-semibold text-warning">Flag Reason:</span>
                <p className="text-xs text-warning whitespace-pre-line">
                  {campaign.flagged_reason}
                </p>
              </div>
            )}
            <div className="mb-2">
              <span className="text-xs font-semibold text-text">Samples:</span>
              <ul className="list-disc pl-5">
                {(campaign.samples || []).map((sample) => (
                  <li key={sample.id} className="mb-1">
                    <span className="text-xs text-text">{sample.sample_label}</span>
                    {sample.coa && (
                      <span className="ml-2 text-xs">
                        COA:{' '}
                        <Badge variant={verificationStatusVariant(sample.coa.verification_status)}>
                          {verificationStatusLabel(sample.coa.verification_status)}
                        </Badge>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mb-2">
              <span className="text-xs font-semibold text-text">Funding:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs">
                  {formatUSD(campaign.current_funding_usd)} /{' '}
                  {formatUSD(campaign.funding_threshold_usd)} (Requested:{' '}
                  {formatUSD(campaign.amount_requested_usd)})
                </span>
                <div className="flex-1 h-2 bg-border rounded-xl overflow-hidden">
                  <div
                    className="h-2 bg-teal-400"
                    style={{
                      width: `${Math.min(100, Math.round((campaign.current_funding_usd / campaign.funding_threshold_usd) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="mb-2">
              <span className="text-xs font-semibold text-text">Creator:</span>{' '}
              <a href={`/users/${campaign.creator?.id}`} className="text-xs text-primary underline">
                {campaign.creator?.username || 'Unknown'}
              </a>
            </div>
          </div>
        )}
      </Card>
      {selectedCoa && <VerifyCoaModal coa={selectedCoa} onClose={() => setSelectedCoa(null)} />}
    </>
  );
}

// Dashboard summary component
function DashboardSummary({ campaigns }: { campaigns: CampaignDetailDto[] }): React.ReactElement {
  const flaggedCount = campaigns.filter((c) => c.is_flagged_for_review).length;
  const pendingCoaCount = campaigns.reduce(
    (acc, c) =>
      acc +
      (c.samples
        ?.flatMap((s) => (s.coa ? [s.coa] : []))
        .filter(
          (coa) =>
            coa.verification_status === 'pending' || coa.verification_status === 'code_not_found'
        ).length ?? 0),
    0
  );
  const activeCount = campaigns.filter(
    (c) => c.status === 'created' || c.status === 'funded'
  ).length;

  return (
    <div className="flex gap-3 mb-6">
      <div className="px-4 py-2 rounded-xl bg-amber-100 text-amber-800 text-xs font-medium">
        Flagged: {flaggedCount}
      </div>
      <div className="px-4 py-2 rounded-xl bg-blue-100 text-blue-800 text-xs font-medium">
        Pending COAs: {pendingCoaCount}
      </div>
      <div className="px-4 py-2 rounded-xl bg-teal-100 text-teal-800 text-xs font-medium">
        Active: {activeCount}
      </div>
    </div>
  );
}

// Users tab component
function UsersTab(): React.ReactElement {
  const [search, setSearch] = useState('');
  const { data: usersResp, isLoading } = useAdminUsers(search);
  const users = usersResp?.data ?? [];
  const { mutateAsync: banUser } = useAdminBanUser();
  const { mutateAsync: manageClaim } = useAdminManageClaim();

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
        />
      </div>
      {isLoading && <Spinner />}
      {!isLoading && users.length === 0 && <EmptyState heading="No users found" />}
      {!isLoading && users.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-text-2">
              <th className="py-2">Email</th>
              <th>Username</th>
              <th>Banned</th>
              <th>Claims</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="py-2">{u.email}</td>
                <td>{u.username || '-'}</td>
                <td>{u.is_banned ? 'Yes' : 'No'}</td>
                <td>{u.claims?.join(', ')}</td>
                <td>{u.created_at?.slice(0, 10)}</td>
                <td>
                  <button
                    className="text-xs text-danger underline mr-2"
                    onClick={() => void banUser({ id: u.id, dto: { banned: !u.is_banned } })}
                  >
                    {u.is_banned ? 'Unban' : 'Ban'}
                  </button>
                  <button
                    className="text-xs text-primary underline mr-2"
                    onClick={() =>
                      void manageClaim({
                        id: u.id,
                        dto: {
                          claim_type: 'admin',
                          action: u.claims?.includes('admin') ? 'revoke' : 'grant',
                        },
                      })
                    }
                  >
                    {u.claims?.includes('admin') ? 'Revoke Admin' : 'Grant Admin'}
                  </button>
                  <button
                    className="text-xs text-primary underline"
                    onClick={() =>
                      void manageClaim({
                        id: u.id,
                        dto: {
                          claim_type: 'lab_approver',
                          action: u.claims?.includes('lab_approver') ? 'revoke' : 'grant',
                        },
                      })
                    }
                  >
                    {u.claims?.includes('lab_approver')
                      ? 'Revoke Lab Approver'
                      : 'Grant Lab Approver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Config tab — shows typed inputs based on the runtime type of the config value.
// All hooks must be called unconditionally (rules of hooks).
function ConfigValueEditor({
  cfgKey,
  rawJson,
  isPending,
  onSave,
  onCancel,
}: {
  cfgKey: string;
  rawJson: string;
  isPending: boolean;
  onSave: (raw: string) => void;
  onCancel: () => void;
}): React.ReactElement {
  const parsed: unknown = JSON.parse(rawJson);
  const type = typeof parsed;

  // Declare all state unconditionally — only the active branch is used to save
  const [boolVal, setBoolVal] = useState<boolean>(type === 'boolean' ? (parsed as boolean) : false);
  const [numVal, setNumVal] = useState<string>(type === 'number' ? String(parsed) : '');
  const [strVal, setStrVal] = useState<string>(type === 'string' ? (parsed as string) : '');
  const [jsonVal, setJsonVal] = useState<string>(rawJson);

  if (type === 'boolean') {
    return (
      <div className="flex items-center gap-4 mt-2">
        <button
          type="button"
          role="switch"
          aria-checked={boolVal}
          className={[
            'relative inline-flex h-7 w-12 items-center rounded-full transition-colors',
            boolVal ? 'bg-primary' : 'bg-border',
          ].join(' ')}
          onClick={() => setBoolVal((v) => !v)}
        >
          <span
            className={[
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mx-1',
              boolVal ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
        <span className="text-sm text-text font-medium">{boolVal ? 'Enabled' : 'Disabled'}</span>
        <Button
          variant="primary"
          size="sm"
          loading={isPending}
          onClick={() => onSave(String(boolVal))}
        >
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  if (type === 'number') {
    return (
      <div className="flex gap-2 mt-2 items-center">
        <input
          key={cfgKey}
          type="number"
          className="flex-1 rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          value={numVal}
          onChange={(e) => setNumVal(e.target.value)}
          autoFocus
        />
        <Button variant="primary" size="sm" loading={isPending} onClick={() => onSave(numVal)}>
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  if (type === 'string') {
    return (
      <div className="flex gap-2 mt-2 items-center">
        <input
          key={cfgKey}
          type="text"
          className="flex-1 rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          value={strVal}
          onChange={(e) => setStrVal(e.target.value)}
          autoFocus
        />
        <Button
          variant="primary"
          size="sm"
          loading={isPending}
          onClick={() => onSave(JSON.stringify(strVal))}
        >
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  // object / array — raw JSON textarea fallback
  return (
    <>
      <textarea
        key={cfgKey}
        className="w-full rounded-xl border border-border px-3 py-2 text-xs font-mono bg-surface min-h-[80px] mt-2"
        value={jsonVal}
        onChange={(e) => setJsonVal(e.target.value)}
        rows={6}
        autoFocus
      />
      <div className="flex gap-2 mt-2">
        <Button variant="primary" size="sm" loading={isPending} onClick={() => onSave(jsonVal)}>
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  );
}

function ConfigTab(): React.ReactElement {
  const { data: configs, isLoading } = useAdminConfig();
  const toast = useToast();
  const { mutateAsync: updateConfig, isPending: updatingConfig } = useAdminUpdateConfig();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = (cfgKey: string, raw: string): void => {
    void (async () => {
      setValidationError(null);
      try {
        const parsed: unknown = JSON.parse(raw);
        await updateConfig({ key: cfgKey, dto: { value: parsed } });
        setEditKey(null);
        toast.success('Config updated');
      } catch (err: unknown) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
            'string'
        ) {
          setValidationError(
            (err as { response: { data: { message: string } } }).response.data.message
          );
        } else if (err instanceof SyntaxError) {
          setValidationError('Invalid value');
        } else {
          setValidationError('Update failed');
        }
      }
    })();
  };

  if (isLoading) return <Spinner />;
  if (!configs || configs.length === 0) {
    return <EmptyState heading="No config found" />;
  }

  return (
    <div className="space-y-3">
      {configs.map((cfg) => (
        <Card key={cfg.id} padding="md">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-sm text-text">{cfg.config_key}</p>
            {editKey !== cfg.config_key && (
              <Button variant="ghost" size="sm" onClick={() => setEditKey(cfg.config_key)}>
                Edit
              </Button>
            )}
          </div>
          {cfg.description && <p className="text-xs text-text-2 mb-2">{cfg.description}</p>}
          {editKey === cfg.config_key ? (
            <>
              <ConfigValueEditor
                cfgKey={cfg.config_key}
                rawJson={JSON.stringify(cfg.config_value)}
                isPending={updatingConfig}
                onSave={(raw) => handleSave(cfg.config_key, raw)}
                onCancel={() => {
                  setEditKey(null);
                  setValidationError(null);
                }}
              />
              {validationError && <p className="text-xs text-danger mt-1">{validationError}</p>}
            </>
          ) : (
            <div className="text-sm text-text bg-surface-a rounded-lg px-3 py-2 font-mono">
              {String(cfg.config_value)}
            </div>
          )}
          <p className="text-xs text-text-3 mt-2">Updated: {cfg.updated_at}</p>
        </Card>
      ))}
    </div>
  );
}

// Fee Sweep tab
interface SweepForm {
  destination_address: string;
}

function FeeSweepTab(): React.ReactElement {
  const toast = useToast();
  const { mutateAsync: sweepFees, isPending } = useAdminFeeSweep();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SweepForm>();

  const onSweep = handleSubmit(async (data) => {
    if (!isValidSolanaAddress(data.destination_address)) {
      toast.error('Invalid Solana address');
      return;
    }
    for (const currency of ['usdc', 'usdt'] as const) {
      try {
        await sweepFees({ destination_address: data.destination_address, currency });
        toast.success(`${currency.toUpperCase()} fees swept`);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : `Failed to sweep ${currency}`);
      }
    }
  });

  return (
    <Card padding="lg">
      <h3 className="font-bold text-base mb-4">Sweep Platform Fees</h3>
      <form onSubmit={(e) => void onSweep(e)} className="space-y-4">
        <div>
          <label htmlFor="sweep-address" className="text-sm font-medium text-text block mb-1">
            Destination Solana Address
          </label>
          <input
            id="sweep-address"
            type="text"
            inputMode="none"
            autoComplete="off"
            className="w-full rounded-xl border border-border px-4 py-3 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px] font-mono"
            {...register('destination_address', { required: 'Address required' })}
          />
          {errors.destination_address && (
            <p className="text-sm text-danger mt-1">{errors.destination_address.message}</p>
          )}
        </div>
        <Button type="submit" variant="primary" fullWidth loading={isPending}>
          Sweep Fees (USDC + USDT)
        </Button>
      </form>
    </Card>
  );
}

export function AdminPage(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const isAdmin = isAuthenticated && (user?.claims ?? []).includes('admin');

  const { data: campaignsData, isLoading: campaignsLoading } = useAdminCampaigns({
    status: campaignStatusFilter || undefined,
    flagged: flaggedOnly || undefined,
  });

  if (!isAdmin) {
    return (
      <AppShell>
        <PageContainer className="py-6">
          <EmptyState
            heading="Access Denied"
            subtext="You don't have admin access."
            ctaLabel="Go Home"
            onCta={() => void navigate('/')}
          />
        </PageContainer>
      </AppShell>
    );
  }

  const campaigns = campaignsData?.data ?? [];

  const tabs = [
    {
      id: 'campaigns',
      label: 'Campaigns',
      content: (
        <div>
          <div className="flex gap-2 mb-4">
            <select
              value={campaignStatusFilter}
              onChange={(e) => setCampaignStatusFilter(e.target.value)}
              className="flex-1 rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
            >
              <option value="">All Status</option>
              <option value="created">Open</option>
              <option value="funded">Funded</option>
              <option value="samples_sent">Samples Sent</option>
              <option value="resolved">Resolved</option>
              <option value="refunded">Refunded</option>
            </select>
            <button
              type="button"
              onClick={() => setFlaggedOnly((v) => !v)}
              className={[
                'px-3 py-2 rounded-xl border text-sm font-medium min-h-[44px] transition-colors',
                flaggedOnly
                  ? 'bg-amber-100 border-amber-300 text-amber-800'
                  : 'border-border text-text-2',
              ].join(' ')}
            >
              {flaggedOnly ? '⚠️ Flagged' : 'All'}
            </button>
          </div>
          {campaignsLoading && <Spinner />}
          {!campaignsLoading && campaigns.length === 0 && <EmptyState heading="No campaigns" />}
          {campaigns.map((c) => (
            <AdminCampaignRow key={c.id} campaign={c} />
          ))}
        </div>
      ),
    },
    {
      id: 'users',
      label: 'Users',
      content: <UsersTab />,
    },
    {
      id: 'config',
      label: 'Config',
      content: <ConfigTab />,
    },
    {
      id: 'fees',
      label: 'Fee Sweep',
      content: <FeeSweepTab />,
    },
  ];

  return (
    <AppShell>
      <PageContainer className="py-4">
        <h1 className="text-2xl font-bold text-text mb-6">Admin Dashboard</h1>
        <DashboardSummary campaigns={campaigns} />
        <Tabs tabs={tabs} defaultTab="campaigns" />
      </PageContainer>
    </AppShell>
  );
}
