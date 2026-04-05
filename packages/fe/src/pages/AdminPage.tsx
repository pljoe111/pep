import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { campaignStatusVariant, campaignStatusLabel } from '../lib/badgeUtils';
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
import type {
  CampaignDetailDto,
  CoaDto,
  LabDetailDto,
  LabTestDto,
  PeptideDto,
  TestDto,
  VendorDto,
  ClaimKind,
} from 'api-client';
import { labsApi, testsApi } from '../api/apiClient';
import axiosInstance from '../api/axiosInstance';
import {
  useLabs,
  useLabDetail,
  useTests,
  useApproveLab,
  useDeactivateLabTest,
  useDeactivateLab,
  useReactivateLab,
  useReactivateLabTest,
  useDisableTest,
  useEnableTest,
  useDeleteLab,
  useDeleteTest,
  useDeleteLabTest,
  useTestClaimTemplates,
  useCreateTestClaimTemplate,
  useDeleteTestClaimTemplate,
} from '../api/hooks/useLabs';
import {
  useAllPeptides,
  useCreatePeptide,
  useApprovePeptide,
  useRejectPeptide,
  useDisablePeptide,
  useEnablePeptide,
  useDeletePeptide,
} from '../api/hooks/usePeptides';
import {
  useAllVendors,
  useCreateVendor,
  useReviewVendor,
  useReinstateVendor,
  useDeleteVendor,
} from '../api/hooks/useVendors';

/**
 * Extracts a human-readable message from an API error response.
 * Axios wraps server bodies under error.response.data; this unwraps them so users
 * see the real message (e.g. "Cannot delete lab: it still has 2 associated test(s)")
 * instead of the generic "Request failed with status code 409".
 */
function extractApiError(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message ===
      'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }
  return error instanceof Error ? error.message : fallback;
}

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

// Compact campaign card for 2-column grid
function AdminCampaignCard({ campaign }: { campaign: CampaignDetailDto }): React.ReactElement {
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

  const progressPercent = Math.min(
    100,
    Math.round((campaign.current_funding_usd / campaign.funding_threshold_usd) * 100)
  );

  return (
    <>
      <Card padding="sm" className="flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <Link
              to={`/campaigns/${campaign.id}`}
              className="font-bold text-sm text-text leading-tight hover:text-primary transition-colors block truncate"
            >
              {campaign.title}
            </Link>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant={campaignStatusVariant(campaign.status)}>
                {campaignStatusLabel(campaign.status)}
              </Badge>
              {campaign.is_flagged_for_review && <Badge variant="amber">Flagged</Badge>}
              {campaign.is_hidden && <Badge variant="gray">Hidden</Badge>}
            </div>
          </div>
          <p className="text-sm font-bold text-primary shrink-0">
            {formatUSD(campaign.current_funding_usd)}
          </p>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-text-2 mb-2">
          <Link
            to={`/users/${campaign.creator?.id}`}
            className="text-primary hover:underline truncate"
          >
            {campaign.creator?.username ?? 'Unknown'}
          </Link>
          <span>·</span>
          <span>{campaign.samples?.length ?? 0} samples</span>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-400 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-text-2 shrink-0">{progressPercent}%</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 flex-wrap mt-auto">
          <Button
            variant="danger"
            size="sm"
            loading={refundPending}
            onClick={() => void handleRefund()}
          >
            Refund
          </Button>
          <Button variant="ghost" size="sm" loading={hidePending} onClick={() => void handleHide()}>
            {isHidden ? 'Unhide' : 'Hide'}
          </Button>
          <Button
            variant={campaign.is_flagged_for_review ? 'ghost' : 'danger'}
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
            {campaign.is_flagged_for_review ? 'Unflag' : 'Flag'}
          </Button>
          {pendingCoas.length > 0 && (
            <button
              type="button"
              className="text-xs text-primary hover:underline px-1 py-0.5"
              onClick={() => setExpanded((v) => !v)}
            >
              {pendingCoas.length} COA{pendingCoas.length > 1 ? 's' : ''}
            </button>
          )}
          <button
            type="button"
            className="text-xs text-text-3 hover:text-text px-1 py-0.5 ml-auto"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Less' : 'More'}
          </button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            {pendingCoas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text mb-1">Pending COAs:</p>
                {pendingCoas.map((coa) => (
                  <div key={coa.id} className="flex items-center justify-between py-0.5">
                    <span className="text-xs text-text-2 truncate">{coa.file_name}</span>
                    <Button variant="secondary" size="sm" onClick={() => setSelectedCoa(coa)}>
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <span className="text-xs font-semibold text-text">Funding:</span>
              <span className="text-xs text-text-2 ml-1">
                {formatUSD(campaign.current_funding_usd)} /{' '}
                {formatUSD(campaign.funding_threshold_usd)}
              </span>
            </div>
            {campaign.flagged_reason && (
              <div>
                <span className="text-xs font-semibold text-warning">Flag:</span>
                <span className="text-xs text-warning ml-1">{campaign.flagged_reason}</span>
              </div>
            )}
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

// User card for card-based layout
function UserCard({
  user,
}: {
  user: {
    id: string;
    email: string;
    username: string | null;
    is_banned: boolean;
    claims: string[];
    created_at: string;
  };
}): React.ReactElement {
  const toast = useToast();
  const { mutateAsync: banUser, isPending: banPending } = useAdminBanUser();
  const { mutateAsync: manageClaim, isPending: claimPending } = useAdminManageClaim();
  const [expanded, setExpanded] = useState(false);

  const handleBan = async (): Promise<void> => {
    try {
      await banUser({ id: user.id, dto: { banned: !user.is_banned } });
      toast.success(user.is_banned ? 'User unbanned' : 'User banned');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update ban status');
    }
  };

  const handleToggleClaim = async (claimType: 'admin' | 'lab_approver'): Promise<void> => {
    const hasClaim = user.claims.includes(claimType);
    try {
      await manageClaim({
        id: user.id,
        dto: { claim_type: claimType, action: hasClaim ? 'revoke' : 'grant' },
      });
      toast.success(`${claimType} claim ${hasClaim ? 'revoked' : 'granted'}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update claim');
    }
  };

  const isAdmin = user.claims.includes('admin');
  const isLabApprover = user.claims.includes('lab_approver');

  return (
    <Card padding="sm">
      <div className="flex items-start gap-3">
        <Avatar username={user.username ?? undefined} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-sm text-text truncate">
                {user.username ?? 'No username'}
              </p>
              <p className="text-xs text-text-2 truncate">{user.email}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {user.is_banned && <Badge variant="red">Banned</Badge>}
              {isAdmin && <Badge variant="purple">Admin</Badge>}
              {isLabApprover && <Badge variant="teal">Lab</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant={user.is_banned ? 'secondary' : 'danger'}
              size="sm"
              loading={banPending}
              onClick={() => void handleBan()}
            >
              {user.is_banned ? 'Unban' : 'Ban'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={claimPending}
              onClick={() => void handleToggleClaim('admin')}
            >
              {isAdmin ? 'Revoke Admin' : 'Grant Admin'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={claimPending}
              onClick={() => void handleToggleClaim('lab_approver')}
            >
              {isLabApprover ? 'Revoke Lab' : 'Grant Lab'}
            </Button>
            <button
              type="button"
              className="text-xs text-text-3 hover:text-text ml-auto px-1"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Less' : 'More'}
            </button>
          </div>
          {expanded && (
            <div className="mt-2 pt-2 border-t border-border text-xs text-text-2">
              <p>Created: {user.created_at?.slice(0, 10)}</p>
              <p>Claims: {user.claims.join(', ') || 'None'}</p>
              <Link to={`/users/${user.id}`} className="text-primary hover:underline">
                View Profile
              </Link>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// Users tab component — card-based layout
function UsersTab(): React.ReactElement {
  const [search, setSearch] = useState('');
  const { data: usersResp, isLoading } = useAdminUsers(search);
  const users = usersResp?.data ?? [];

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search users by email or username..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-border px-4 py-3 text-sm text-text bg-surface min-h-[44px]"
      />
      {isLoading && <Spinner />}
      {!isLoading && users.length === 0 && <EmptyState heading="No users found" />}
      {!isLoading && users.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={{
                id: u.id,
                email: u.email,
                username: u.username,
                is_banned: u.is_banned,
                claims: u.claims ?? [],
                created_at: u.created_at ?? '',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Human-readable label from snake_case
function formatLabel(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Safe stringification that handles all types properly
function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (typeof value === 'object') return JSON.stringify(value);
  // At this point value is string | number | symbol | bigint | function
  return String(value as string | number);
}

// Deep equality check for detecting changes
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== (b as unknown[]).length) return false;
    return a.every((v, i) => deepEqual(v, (b as unknown[])[i]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}

// Confirmation modal showing before/after
function ConfirmConfigChangeModal({
  cfgKey,
  before,
  after,
  onConfirm,
  onCancel,
  isPending,
}: {
  cfgKey: string;
  before: unknown;
  after: unknown;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}): React.ReactElement {
  const renderValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-text-3">null</span>;
    if (typeof value === 'boolean') {
      return (
        <span className={value ? 'text-success' : 'text-text-3'}>
          {value ? 'Enabled' : 'Disabled'}
        </span>
      );
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div className="space-y-1">
          {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-xs text-text-2 w-36 shrink-0">{formatLabel(k)}</span>
              <span className="text-sm font-mono">{safeStringify(v)}</span>
            </div>
          ))}
        </div>
      );
    }
    return <span className="font-mono">{safeStringify(value)}</span>;
  };

  return (
    <Modal isOpen title={`Confirm: ${formatLabel(cfgKey)}`} onClose={onCancel}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-text-2 mb-1">Current Value</p>
          <div className="bg-surface-a rounded-lg px-3 py-2">{renderValue(before)}</div>
        </div>
        <div className="flex justify-center">
          <svg className="w-5 h-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v9.586l3.293-3.293a1 1 0 111.414 1.414l-5 5a1 1 0 01-1.414 0l-5-5a1 1 0 011.414-1.414L9 13.586V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-primary mb-1">New Value</p>
          <div className="bg-primary-l rounded-lg px-3 py-2">{renderValue(after)}</div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="primary" size="md" fullWidth loading={isPending} onClick={onConfirm}>
            Confirm Change
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Single config section with inline inputs
function ConfigSection({
  cfg,
  isPending,
  onSave,
}: {
  cfg: {
    id: string;
    config_key: string;
    config_value: unknown;
    description: string;
    updated_at: string;
  };
  isPending: boolean;
  onSave: (value: unknown) => void;
}): React.ReactElement {
  const value = cfg.config_value;
  const type = typeof value;

  // State for each type — only the relevant one is used
  const [boolVal, setBoolVal] = useState<boolean>(type === 'boolean' ? (value as boolean) : false);
  const [numVal, setNumVal] = useState<string>(type === 'number' ? String(value) : '');
  const [strVal, setStrVal] = useState<string>(type === 'string' ? (value as string) : '');
  const [objVals, setObjVals] = useState<Record<string, string>>(
    type === 'object' && value !== null && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, String(v)])
        )
      : {}
  );
  const [jsonVal, setJsonVal] = useState<string>(JSON.stringify(value, null, 2));

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingValue, setPendingValue] = useState<unknown>(null);

  const hasChanges = (): boolean => {
    if (type === 'boolean') return boolVal !== value;
    if (type === 'number') return numVal === '' || Number(numVal) !== value;
    if (type === 'string') return strVal !== value;
    if (type === 'object' && value !== null && !Array.isArray(value)) {
      const converted: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(objVals)) {
        const orig = (value as Record<string, unknown>)[k];
        if (typeof orig === 'number') converted[k] = Number(v);
        else if (typeof orig === 'boolean') converted[k] = v === 'true';
        else converted[k] = v;
      }
      return !deepEqual(converted, value);
    }
    try {
      const parsed: unknown = JSON.parse(jsonVal);
      return !deepEqual(parsed, value);
    } catch {
      return true;
    }
  };

  const handleSaveClick = (): void => {
    let newValue: unknown;
    if (type === 'boolean') newValue = boolVal;
    else if (type === 'number') newValue = Number(numVal);
    else if (type === 'string') newValue = strVal;
    else if (type === 'object' && value !== null && !Array.isArray(value)) {
      newValue = {};
      for (const [k, v] of Object.entries(objVals)) {
        const orig = (value as Record<string, unknown>)[k];
        if (typeof orig === 'number') (newValue as Record<string, unknown>)[k] = Number(v);
        else if (typeof orig === 'boolean') (newValue as Record<string, unknown>)[k] = v === 'true';
        else (newValue as Record<string, unknown>)[k] = v;
      }
    } else {
      try {
        newValue = JSON.parse(jsonVal);
      } catch {
        return;
      }
    }
    setPendingValue(newValue);
    setShowConfirm(true);
  };

  const handleConfirm = (): void => {
    if (pendingValue !== null) {
      onSave(pendingValue);
      setShowConfirm(false);
      setPendingValue(null);
    }
  };

  const renderInputs = (): React.ReactNode => {
    if (type === 'boolean') {
      return (
        <div className="flex items-center gap-3">
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
        </div>
      );
    }

    if (type === 'number') {
      return (
        <input
          type="number"
          step="0.01"
          className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          value={numVal}
          onChange={(e) => setNumVal(e.target.value)}
        />
      );
    }

    if (type === 'string') {
      return (
        <input
          type="text"
          className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          value={strVal}
          onChange={(e) => setStrVal(e.target.value)}
        />
      );
    }

    if (type === 'object' && value !== null && !Array.isArray(value)) {
      return (
        <div className="space-y-3">
          {Object.entries(objVals).map(([key]) => {
            const orig = (value as Record<string, unknown>)[key];
            const isNumber = typeof orig === 'number';
            const isBool = typeof orig === 'boolean';
            return (
              <div key={key} className="flex items-center gap-2">
                <label
                  htmlFor={`${cfg.config_key}-${key}`}
                  className="text-xs font-medium text-text w-40 shrink-0"
                >
                  {formatLabel(key)}
                </label>
                {isBool ? (
                  <select
                    id={`${cfg.config_key}-${key}`}
                    value={objVals[key]}
                    onChange={(e) => setObjVals((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="flex-1 rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                ) : (
                  <input
                    id={`${cfg.config_key}-${key}`}
                    type={isNumber ? 'number' : 'text'}
                    step={isNumber ? '0.01' : undefined}
                    value={objVals[key]}
                    onChange={(e) => setObjVals((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="flex-1 rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
                  />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <textarea
        className="w-full rounded-xl border border-border px-3 py-2 text-xs font-mono bg-surface min-h-[80px]"
        value={jsonVal}
        onChange={(e) => setJsonVal(e.target.value)}
        rows={6}
      />
    );
  };

  return (
    <>
      <Card padding="md">
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-sm text-text">{cfg.config_key}</p>
        </div>
        {cfg.description && <p className="text-xs text-text-2 mb-3">{cfg.description}</p>}
        <div className="space-y-3">{renderInputs()}</div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <p className="text-xs text-text-3">Updated: {cfg.updated_at}</p>
          <Button
            variant="primary"
            size="sm"
            loading={isPending}
            disabled={!hasChanges()}
            onClick={handleSaveClick}
          >
            Save
          </Button>
        </div>
      </Card>
      {showConfirm && pendingValue !== null && (
        <ConfirmConfigChangeModal
          cfgKey={cfg.config_key}
          before={cfg.config_value}
          after={pendingValue}
          onConfirm={handleConfirm}
          onCancel={() => {
            setShowConfirm(false);
            setPendingValue(null);
          }}
          isPending={isPending}
        />
      )}
    </>
  );
}

function ConfigTab(): React.ReactElement {
  const { data: configs, isLoading } = useAdminConfig();
  const toast = useToast();
  const { mutateAsync: updateConfig, isPending: updatingConfig } = useAdminUpdateConfig();

  const handleSave = async (cfgKey: string, value: unknown): Promise<void> => {
    try {
      await updateConfig({ key: cfgKey, dto: { value } });
      toast.success('Config updated');
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
          'string'
      ) {
        toast.error((err as { response: { data: { message: string } } }).response.data.message);
      } else {
        toast.error('Update failed');
      }
    }
  };

  if (isLoading) return <Spinner />;
  if (!configs || configs.length === 0) {
    return <EmptyState heading="No config found" />;
  }

  return (
    <div className="space-y-3">
      {configs.map((cfg) => (
        <ConfigSection
          key={cfg.id}
          cfg={cfg}
          isPending={updatingConfig}
          onSave={(value) => void handleSave(cfg.config_key, value)}
        />
      ))}
    </div>
  );
}

// Labs tab
function LabsTab(): React.ReactElement {
  const [showDisabled, setShowDisabled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: labsResp, isLoading: labsLoading } = useLabs(false, !showDisabled);
  const { data: testsResp, isLoading: testsLoading } = useTests(!showDisabled);
  const labs = labsResp?.data ?? [];
  const tests = testsResp ?? [];
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [showCreateLab, setShowCreateLab] = useState(false);
  const [showCreateTest, setShowCreateTest] = useState(false);

  // Fetch lab detail when a lab is selected for editing
  const { data: selectedLabDetail, refetch: refetchLabDetail } = useLabDetail(selectedLabId ?? '');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="relative">
          <Button variant="primary" size="sm" onClick={() => setMenuOpen(!menuOpen)}>
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
            </svg>
            Actions
          </Button>
          {menuOpen && (
            <div className="absolute z-10 mt-1 w-48 bg-surface border border-border rounded-xl shadow-lg py-1">
              <button
                type="button"
                onClick={() => {
                  setShowCreateLab(true);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-text hover:bg-surface-a"
              >
                Add Lab
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateTest(true);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-text hover:bg-surface-a"
              >
                Add Test
              </button>
            </div>
          )}
        </div>

        {/* Visible toggle — always shows the current filter state */}
        <button
          type="button"
          onClick={() => setShowDisabled((v) => !v)}
          className={[
            'px-3 py-2 rounded-xl border text-sm font-medium min-h-[44px] transition-colors',
            showDisabled
              ? 'bg-primary-l border-primary text-primary'
              : 'border-border text-text-2 hover:border-text-3',
          ].join(' ')}
        >
          {showDisabled ? '◉ Showing Disabled' : 'Show Disabled'}
        </button>
      </div>

      {showCreateLab && (
        <LabModal mode="create" onClose={() => setShowCreateLab(false)} tests={tests} />
      )}
      {showCreateTest && <CreateTestModal onClose={() => setShowCreateTest(false)} />}

      {labsLoading && <Spinner />}
      {!labsLoading && labs.length === 0 && (
        <EmptyState heading={showDisabled ? 'No labs found' : 'No active labs found'} />
      )}
      {!labsLoading && labs.length > 0 && (
        <div className="space-y-3">
          {labs.map((lab) => (
            <Card key={lab.id} padding="md" className={!lab.is_active ? 'opacity-60' : ''}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-bold text-sm text-text">{lab.name}</h4>
                  <p className="text-xs text-text-2">{lab.country}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={lab.is_approved ? 'green' : 'amber'}>
                    {lab.is_approved ? 'Approved' : 'Pending'}
                  </Badge>
                  {!lab.is_active && <Badge variant="gray">Disabled</Badge>}
                  {!lab.is_approved && lab.is_active && (
                    <ApproveLabButton labId={lab.id} labName={lab.name} />
                  )}
                  {lab.is_active && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLabId(lab.id)}>
                      Edit
                    </Button>
                  )}
                  {lab.is_active && <DisableLabButton labId={lab.id} labName={lab.name} />}
                  {!lab.is_active && <ReactivateLabButton labId={lab.id} labName={lab.name} />}
                  {!lab.is_active && <DeleteLabButton labId={lab.id} labName={lab.name} />}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedLabDetail && (
        <LabModal
          mode="edit"
          lab={selectedLabDetail}
          tests={tests}
          onClose={() => setSelectedLabId(null)}
          onTestAdded={() => void refetchLabDetail()}
        />
      )}

      {testsLoading && <Spinner />}
      {!testsLoading && tests.length > 0 && (
        <Card padding="md">
          <h3 className="font-bold text-base mb-3">Test Catalog</h3>
          <div className="space-y-2">
            {tests.map((test) => (
              <TestCatalogRow key={test.id} test={test} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function TestCatalogRow({ test }: { test: TestDto }): React.ReactElement {
  const toast = useToast();
  const { mutateAsync: disableTest, isPending: isDisabling } = useDisableTest();
  const { mutateAsync: enableTest, isPending: isEnabling } = useEnableTest();
  const { mutateAsync: deleteTest, isPending: isDeleting } = useDeleteTest();
  const { mutateAsync: createClaimTemplate, isPending: isCreatingTemplate } =
    useCreateTestClaimTemplate();
  const { mutateAsync: deleteClaimTemplate } = useDeleteTestClaimTemplate();
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClaimTemplates, setShowClaimTemplates] = useState(false);
  const [addKind, setAddKind] = useState<ClaimKind>('mass');
  const [addLabel, setAddLabel] = useState('');
  const [addIsRequired, setAddIsRequired] = useState(true);
  const [addSortOrder, setAddSortOrder] = useState(0);
  const { data: claimTemplateList = [] } = useTestClaimTemplates(showClaimTemplates ? test.id : '');

  const handleDisable = async (): Promise<void> => {
    try {
      await disableTest(test.id);
      toast.success(`${test.name} disabled`);
      setShowDisableConfirm(false);
    } catch (error: unknown) {
      toast.error(extractApiError(error, 'Failed to disable test'));
    }
  };

  const handleEnable = async (): Promise<void> => {
    try {
      await enableTest(test.id);
      toast.success(`${test.name} enabled`);
    } catch (error: unknown) {
      toast.error(extractApiError(error, 'Failed to enable test'));
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    try {
      await deleteTest(test.id);
      toast.success(`${test.name} permanently deleted`);
      setShowDeleteConfirm(false);
    } catch (error: unknown) {
      toast.error(extractApiError(error, 'Failed to delete test'));
    }
  };

  return (
    <>
      <div
        className={`py-2 border-b border-border last:border-0 ${
          !test.is_active ? 'opacity-60' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text">{test.name}</p>
            <p className="text-xs text-text-2">{test.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs text-primary font-medium min-h-[32px] px-2"
              onClick={() => setShowClaimTemplates(!showClaimTemplates)}
            >
              {showClaimTemplates ? 'Hide' : 'Claims'}
              {test.claim_templates.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-xs bg-primary text-surface rounded-full">
                  {test.claim_templates.length}
                </span>
              )}
            </button>
            <Badge variant={test.is_active ? 'green' : 'gray'}>
              {test.is_active ? 'Active' : 'Disabled'}
            </Badge>
            {test.is_active ? (
              <Button
                variant="ghost"
                size="sm"
                loading={isDisabling}
                onClick={() => setShowDisableConfirm(true)}
              >
                Disable
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={isEnabling}
                  onClick={() => void handleEnable()}
                >
                  Enable
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={isDeleting}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Expandable Claim Templates section */}
        {showClaimTemplates && (
          <div className="mt-2 ml-2 pl-3 border-l-2 border-border space-y-2">
            <p className="text-xs font-semibold text-text-2 uppercase tracking-wide">
              Claim Templates
            </p>

            {/* Existing templates */}
            {claimTemplateList.length === 0 ? (
              <p className="text-xs text-text-3">No claim templates yet.</p>
            ) : (
              <div className="space-y-1">
                {claimTemplateList.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="flex items-center justify-between px-2 py-1.5 bg-surface-a rounded-lg text-xs"
                  >
                    <span>
                      <span className="font-medium capitalize">{tmpl.claim_kind}</span>:{' '}
                      {tmpl.label}
                      {tmpl.is_required && (
                        <span className="ml-2 text-primary font-medium">Required</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="text-danger hover:underline text-xs min-h-[28px] px-1"
                      onClick={() => {
                        void deleteClaimTemplate({ templateId: tmpl.id, testId: test.id });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new template form */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={addKind}
                onChange={(e) => setAddKind(e.target.value as ClaimKind)}
                className="rounded-lg border border-border px-2 py-1 text-xs text-text bg-surface min-h-[32px]"
              >
                <option value="mass">Mass Amount</option>
                <option value="purity">Purity Percent</option>
                <option value="identity">Identity</option>
                <option value="endotoxins">Endotoxins</option>
                <option value="sterility">Sterility</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                placeholder="Label"
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                className="rounded-lg border border-border px-2 py-1 text-xs text-text bg-surface min-h-[32px]"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-text">
                <input
                  type="checkbox"
                  checked={addIsRequired}
                  onChange={(e) => setAddIsRequired(e.target.checked)}
                  className="w-3.5 h-3.5 accent-primary"
                />
                Required
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-2">Sort:</span>
                <input
                  type="number"
                  min="0"
                  value={addSortOrder}
                  onChange={(e) => setAddSortOrder(Number(e.target.value))}
                  className="w-12 rounded-lg border border-border px-1 py-0.5 text-xs text-text bg-surface min-h-[28px]"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={isCreatingTemplate}
                onClick={() => {
                  if (!addLabel.trim()) {
                    toast.error('Label is required');
                    return;
                  }
                  void createClaimTemplate({
                    testId: test.id,
                    claim_kind: addKind,
                    label: addLabel,
                    is_required: addIsRequired,
                    sort_order: addSortOrder,
                  }).then(() => {
                    setAddLabel('');
                  });
                }}
              >
                Add
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Cascade-disable confirmation modal */}
      {showDisableConfirm && (
        <Modal isOpen title="Disable Test Type" onClose={() => setShowDisableConfirm(false)}>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-surface-a border border-border">
              <p className="text-sm font-bold text-warning mb-1">⚠️ Cascading Action</p>
              <p className="text-sm text-text">
                Disabling <strong>{test.name}</strong> will immediately deactivate this test across{' '}
                <strong>all labs</strong> that currently offer it. Lab staff will need to manually
                re-enable their individual test offerings after you re-enable this test type.
              </p>
            </div>
            <p className="text-sm text-text-2">
              This action takes effect immediately for all affected labs.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="md"
                fullWidth
                loading={isDisabling}
                onClick={() => void handleDisable()}
              >
                Disable Everywhere
              </Button>
              <Button
                variant="ghost"
                size="md"
                fullWidth
                onClick={() => setShowDisableConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Permanent-delete confirmation modal */}
      {showDeleteConfirm && (
        <Modal isOpen title="Permanently Delete Test" onClose={() => setShowDeleteConfirm(false)}>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-surface-a border border-border">
              <p className="text-sm font-bold text-danger mb-1">🗑 Permanent Deletion</p>
              <p className="text-sm text-text">
                <strong>{test.name}</strong> will be permanently removed from the test catalog. This
                cannot be undone.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm font-bold text-warning mb-1">⚠️ Lab cascade</p>
              <p className="text-sm text-text">
                This test will be automatically removed from <strong>every lab</strong> that
                currently lists it (active or inactive), along with all associated price history.
              </p>
              <p className="text-sm text-text-2 mt-1">
                Only blocked if the test has been used in an active campaign.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="md"
                fullWidth
                loading={isDeleting}
                onClick={() => void handleConfirmDelete()}
              >
                Delete Permanently
              </Button>
              <Button
                variant="ghost"
                size="md"
                fullWidth
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/** A single test row being added during lab creation */
interface PendingLabTest {
  testId: string;
  price: string;
  turnaround: string;
  vials: string;
}

function LabModal({
  mode,
  lab,
  tests,
  onClose,
  onTestAdded,
}: {
  mode: 'create' | 'edit';
  lab?: LabDetailDto;
  tests: TestDto[];
  onClose: () => void;
  onTestAdded?: () => void;
}): React.ReactElement {
  const toast = useToast();
  const [name, setName] = useState(lab?.name ?? '');
  const [country, setCountry] = useState(lab?.country ?? '');
  const [phoneNumber, setPhoneNumber] = useState(lab?.phone_number ?? '');
  const [address, setAddress] = useState(lab?.address ?? '');
  const [isPending, setIsPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // "Add Test" section state
  const [selectedTestId, setSelectedTestId] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newTurnaround, setNewTurnaround] = useState('7');
  const [isAddingTest, setIsAddingTest] = useState(false);

  // Create-mode: tests staged locally before lab is submitted
  const [pendingTests, setPendingTests] = useState<PendingLabTest[]>([]);

  const { mutateAsync: deactivateTest } = useDeactivateLabTest();

  const activeTests = tests.filter((t) => t.is_active);

  // IDs already attached — pending list for create, lab.tests for edit
  const attachedTestIds = new Set(
    mode === 'create'
      ? pendingTests.map((r) => r.testId).filter(Boolean)
      : (lab?.tests ?? []).map((t) => t.test_id)
  );
  const availableTests = activeTests.filter((t) => !attachedTestIds.has(t.id));
  const noMoreTests = availableTests.length === 0;

  // Per-row options for create mode (own test + all unselected)
  const rowOptions = (idx: number): TestDto[] => {
    const current = pendingTests[idx]?.testId ?? '';
    return activeTests.filter((t) => !attachedTestIds.has(t.id) || t.id === current);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!country.trim()) newErrors.country = 'Country is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddTest = (): void => {
    if (!selectedTestId || !newPrice) {
      toast.error('Please select a test and enter a price');
      return;
    }
    if (mode === 'create') {
      setPendingTests((prev) => [
        ...prev,
        { testId: selectedTestId, price: newPrice, turnaround: newTurnaround || '7', vials: '1' },
      ]);
      setSelectedTestId('');
      setNewPrice('');
      setNewTurnaround('7');
    } else {
      void (async () => {
        if (!lab) return;
        setIsAddingTest(true);
        try {
          await labsApi.addTest(lab.id, {
            test_id: selectedTestId,
            price_usd: Number(newPrice),
            typical_turnaround_days: Number(newTurnaround) || 7,
            vials_required: 1, // Default to 1 vial when adding test
          });
          toast.success('Test added to lab');
          setSelectedTestId('');
          setNewPrice('');
          setNewTurnaround('7');
          onTestAdded?.();
        } catch (error: unknown) {
          toast.error(extractApiError(error, 'Failed to add test'));
        } finally {
          setIsAddingTest(false);
        }
      })();
    }
  };

  const { mutateAsync: deleteLabTest } = useDeleteLabTest();

  const handleRemoveTest = async (testId: string): Promise<void> => {
    if (!lab) return;
    try {
      await deactivateTest({ labId: lab.id, testId });
      toast.success('Test deactivated');
      onTestAdded?.();
    } catch (error: unknown) {
      toast.error(extractApiError(error, 'Failed to deactivate test'));
    }
  };

  const handleDeleteLabTest = async (testId: string): Promise<void> => {
    if (!lab) return;
    try {
      await deleteLabTest({ labId: lab.id, testId });
      toast.success('Test permanently removed from lab');
      onTestAdded?.();
    } catch (error: unknown) {
      toast.error(extractApiError(error, 'Failed to delete lab test'));
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validate()) return;
    setIsPending(true);
    try {
      if (mode === 'create') {
        const created = await labsApi.create({
          name,
          country,
          phone_number: phoneNumber || undefined,
          address: address || undefined,
        });
        for (const { testId, price, turnaround, vials } of pendingTests) {
          if (testId && price) {
            await labsApi.addTest(created.data.id, {
              test_id: testId,
              price_usd: Number(price),
              typical_turnaround_days: Number(turnaround) || 7,
              vials_required: Number(vials) || 1,
            });
          }
        }
        toast.success('Lab created');
      } else {
        if (!lab) return;
        await labsApi.update(lab.id, {
          name,
          country,
          phone_number: phoneNumber || undefined,
          address: address || undefined,
        });
        toast.success('Lab updated');
      }
      onClose();
    } catch (error: unknown) {
      toast.error(
        extractApiError(error, mode === 'create' ? 'Failed to create lab' : 'Failed to update lab')
      );
    } finally {
      setIsPending(false);
    }
  };

  const title = mode === 'create' ? 'Create Lab' : `Edit Lab: ${lab?.name ?? ''}`;

  return (
    <Modal isOpen title={title} onClose={onClose}>
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="lab-name" className="text-sm font-medium text-text block mb-1">
            Name <span className="text-danger">*</span>
          </label>
          <input
            id="lab-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
            }}
            className={`w-full rounded-xl border px-3 py-2 text-sm text-text bg-surface min-h-[44px] ${
              errors.name ? 'border-danger' : 'border-border'
            }`}
          />
          {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
        </div>

        {/* Country */}
        <div>
          <label htmlFor="lab-country" className="text-sm font-medium text-text block mb-1">
            Country <span className="text-danger">*</span>
          </label>
          <input
            id="lab-country"
            type="text"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              if (errors.country) setErrors((prev) => ({ ...prev, country: '' }));
            }}
            className={`w-full rounded-xl border px-3 py-2 text-sm text-text bg-surface min-h-[44px] ${
              errors.country ? 'border-danger' : 'border-border'
            }`}
          />
          {errors.country && <p className="text-xs text-danger mt-1">{errors.country}</p>}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="lab-phone" className="text-sm font-medium text-text block mb-1">
            Phone
          </label>
          <input
            id="lab-phone"
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="e.g. +1 555-000-0000"
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>

        {/* Address */}
        <div>
          <label htmlFor="lab-address" className="text-sm font-medium text-text block mb-1">
            Address
          </label>
          <input
            id="lab-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 123 Lab St, City, State"
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>

        {/* Lab Tests & Prices */}
        <div className="pt-2 border-t border-border">
          <h4 className="text-sm font-semibold text-text mb-2">Lab Tests & Prices</h4>

          {/* Current test list */}
          {(mode === 'create' ? pendingTests.length > 0 : (lab?.tests ?? []).length > 0) ? (
            <div className="mb-3">
              <div className="flex items-center gap-2 px-2 pb-1 text-xs text-text-3 font-medium">
                <span className="flex-1">Test</span>
                <span className="w-16 text-right">Price</span>
                <span className="w-16 text-right">Days</span>
                <span className="w-12 text-right">Vials</span>
                <span className="w-16 text-right">Actions</span>
              </div>
              <div className="space-y-1">
                {mode === 'create'
                  ? pendingTests.map(({ testId, price, turnaround, vials }, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-a"
                      >
                        <div className="flex-1 min-w-0">
                          <select
                            value={testId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPendingTests((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, testId: val } : r))
                              );
                            }}
                            className="w-full rounded-lg border border-border px-2 py-1 text-xs text-text bg-surface min-h-[32px]"
                          >
                            <option value="">Select test…</option>
                            {rowOptions(idx).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={price}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPendingTests((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, price: val } : r))
                            );
                          }}
                          className="w-16 rounded-lg border border-border px-2 py-1 text-xs text-right text-text bg-surface min-h-[32px]"
                        />
                        <input
                          type="number"
                          placeholder="7"
                          value={turnaround}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPendingTests((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, turnaround: val } : r))
                            );
                          }}
                          className="w-16 rounded-lg border border-border px-2 py-1 text-xs text-right text-text bg-surface min-h-[32px]"
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="1"
                          value={vials}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPendingTests((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, vials: val } : r))
                            );
                          }}
                          className="w-12 rounded-lg border border-border px-2 py-1 text-xs text-right text-text bg-surface min-h-[32px]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPendingTests((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-danger text-xs font-medium min-h-[32px] px-2 w-16 text-right"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  : (lab?.tests ?? []).map((lt) => (
                      <LabTestPriceRow
                        key={lt.test_id}
                        labId={lab?.id ?? ''}
                        labTest={lt}
                        onRemove={() => void handleRemoveTest(lt.test_id)}
                        onDelete={() => void handleDeleteLabTest(lt.test_id)}
                      />
                    ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-3 mb-3">No tests attached yet.</p>
          )}

          {/* Add Test section — always visible */}
          <div className="bg-surface-a border border-border rounded-xl p-3 space-y-2">
            <p className="text-xs font-medium text-text">Add Test to Lab</p>
            {!noMoreTests && (
              <>
                <select
                  value={selectedTestId}
                  onChange={(e) => setSelectedTestId(e.target.value)}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[36px]"
                >
                  <option value="">Select a test…</option>
                  {availableTests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price (USD)"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="flex-1 rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[36px]"
                  />
                  <input
                    type="number"
                    placeholder="Days"
                    value={newTurnaround}
                    onChange={(e) => setNewTurnaround(e.target.value)}
                    className="w-20 rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[36px]"
                  />
                </div>
              </>
            )}
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                loading={isAddingTest}
                disabled={noMoreTests || !selectedTestId || !newPrice}
                onClick={handleAddTest}
              >
                Add
              </Button>
              {noMoreTests && (
                <p className="text-xs text-text-3">No more tests available to add.</p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={isPending}
            onClick={() => void handleSubmit()}
          >
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateTestModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [uspCode, setUspCode] = useState('');
  const [vialsRequired, setVialsRequired] = useState<number>(1);
  const [isPending, setIsPending] = useState(false);
  // Claim templates state
  const [claimTemplates, setClaimTemplates] = useState<
    { claim_kind: ClaimKind; label: string; is_required: boolean; sort_order: number }[]
  >([]);
  const [newClaimKind, setNewClaimKind] = useState<ClaimKind>('mass');
  const [newClaimLabel, setNewClaimLabel] = useState('');
  const [newClaimIsRequired, setNewClaimIsRequired] = useState(true);
  const [newClaimSortOrder, setNewClaimSortOrder] = useState(0);

  const handleCreate = async (): Promise<void> => {
    if (!name || !description) {
      toast.error('Name and description are required');
      return;
    }
    setIsPending(true);
    try {
      const testResult = await testsApi.createTest({
        name,
        description,
        usp_code: uspCode || undefined,
        vials_required: vialsRequired,
      });

      // Create claim templates if any exist
      const newTestId = testResult.data.id;
      for (const tmpl of claimTemplates) {
        await axiosInstance.post(`/tests/${newTestId}/claim-templates`, {
          claim_kind: tmpl.claim_kind,
          label: tmpl.label,
          is_required: tmpl.is_required,
          sort_order: tmpl.sort_order,
        });
      }

      toast.success('Test created');
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create test');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal isOpen title="Create Test" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="test-name" className="text-sm font-medium text-text block mb-1">
            Name *
          </label>
          <input
            id="test-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>
        <div>
          <label htmlFor="test-desc" className="text-sm font-medium text-text block mb-1">
            Description *
          </label>
          <textarea
            id="test-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[80px]"
          />
        </div>
        <div>
          <label htmlFor="test-usp" className="text-sm font-medium text-text block mb-1">
            USP Code (optional)
          </label>
          <input
            id="test-usp"
            type="text"
            value={uspCode}
            onChange={(e) => setUspCode(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>
        <div>
          <label htmlFor="test-vials" className="text-sm font-medium text-text block mb-1">
            Vials Required (default)
          </label>
          <input
            id="test-vials"
            type="number"
            min="1"
            value={vialsRequired}
            onChange={(e) => setVialsRequired(Math.max(1, Number(e.target.value)))}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>

        {/* Claim Templates Section */}
        <div className="pt-2 border-t border-border">
          <h4 className="text-sm font-semibold text-text mb-2">Claim Templates</h4>
          <p className="text-xs text-text-2 mb-3">
            Define default claims that will be auto-suggested when this test is selected in
            campaigns.
          </p>

          {/* Add new template form */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <select
              value={newClaimKind}
              onChange={(e) => setNewClaimKind(e.target.value as ClaimKind)}
              className="rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[36px]"
            >
              <option value="mass">Mass Amount</option>
              <option value="purity">Purity Percent</option>
              <option value="identity">Identity (Peptide Name)</option>
              <option value="endotoxins">Endotoxins</option>
              <option value="sterility">Sterility</option>
              <option value="other">Other</option>
            </select>

            <input
              type="text"
              placeholder="Label (e.g. 'Purity by HPLC')"
              value={newClaimLabel}
              onChange={(e) => setNewClaimLabel(e.target.value)}
              className="rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[36px]"
            />
          </div>

          <div className="flex items-center gap-6 mb-3">
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={newClaimIsRequired}
                onChange={(e) => setNewClaimIsRequired(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              Required in campaign
            </label>

            <div className="flex items-center gap-2">
              <label htmlFor="sort-order" className="text-sm text-text">
                Sort:
              </label>
              <input
                id="sort-order"
                type="number"
                min="0"
                value={newClaimSortOrder}
                onChange={(e) => setNewClaimSortOrder(Number(e.target.value))}
                className="w-16 rounded-xl border border-border px-2 py-1 text-sm text-text bg-surface min-h-[32px]"
              />
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!newClaimLabel.trim()) {
                toast.error('Please enter a label for the claim');
                return;
              }
              setClaimTemplates([
                ...claimTemplates,
                {
                  claim_kind: newClaimKind,
                  label: newClaimLabel,
                  is_required: newClaimIsRequired,
                  sort_order: newClaimSortOrder,
                },
              ]);
              setNewClaimLabel(''); // Reset form after adding
            }}
          >
            Add Claim Template
          </Button>

          {/* Templates list */}
          {claimTemplates.length > 0 && (
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
              {claimTemplates.map((tmpl, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 bg-surface-a rounded-lg text-sm"
                >
                  <div>
                    <span className="font-medium capitalize">{tmpl.claim_kind}</span>: {tmpl.label}
                    {tmpl.is_required && (
                      <span className="ml-2 text-xs text-primary">Required</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setClaimTemplates(claimTemplates.filter((_, i) => i !== idx));
                    }}
                    className="text-danger text-sm hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="md"
            fullWidth
            loading={isPending}
            onClick={() => void handleCreate()}
          >
            Create
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ApproveLabButton({
  labId,
  labName,
}: {
  labId: string;
  labName: string;
}): React.ReactElement {
  const toast = useToast();
  const { mutateAsync: approveLab, isPending } = useApproveLab();

  const handleApprove = async (): Promise<void> => {
    try {
      await approveLab(labId);
      toast.success(`${labName} approved`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve lab');
    }
  };

  return (
    <Button variant="primary" size="sm" loading={isPending} onClick={() => void handleApprove()}>
      Approve
    </Button>
  );
}

function DisableLabButton({
  labId,
  labName,
}: {
  labId: string;
  labName: string;
}): React.ReactElement {
  const toast = useToast();
  const { mutateAsync: deactivateLab, isPending } = useDeactivateLab();

  const handleDisable = async (): Promise<void> => {
    try {
      await deactivateLab(labId);
      toast.success(`${labName} disabled`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to disable lab');
    }
  };

  return (
    <Button variant="ghost" size="sm" loading={isPending} onClick={() => void handleDisable()}>
      Disable
    </Button>
  );
}

function ReactivateLabButton({
  labId,
  labName,
}: {
  labId: string;
  labName: string;
}): React.ReactElement {
  const toast = useToast();
  const { mutateAsync: reactivateLab, isPending } = useReactivateLab();

  const handleReactivate = async (): Promise<void> => {
    try {
      await reactivateLab(labId);
      toast.success(`${labName} reactivated`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to reactivate lab');
    }
  };

  return (
    <Button variant="ghost" size="sm" loading={isPending} onClick={() => void handleReactivate()}>
      Reactivate
    </Button>
  );
}

/**
 * Permanently deletes a disabled lab.
 * Only available for disabled labs; backend guards against deletion when lab-tests still exist.
 */
function DeleteLabButton({
  labId,
  labName,
}: {
  labId: string;
  labName: string;
}): React.ReactElement {
  const toast = useToast();
  const { mutateAsync: deleteLab, isPending } = useDeleteLab();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirmDelete = async (): Promise<void> => {
    try {
      await deleteLab(labId);
      toast.success(`${labName} permanently deleted`);
      setShowConfirm(false);
    } catch (error: unknown) {
      toast.error(extractApiError(error, 'Failed to delete lab'));
    }
  };

  return (
    <>
      <Button variant="danger" size="sm" loading={isPending} onClick={() => setShowConfirm(true)}>
        Delete
      </Button>

      {showConfirm && (
        <Modal isOpen title="Permanently Delete Lab" onClose={() => setShowConfirm(false)}>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-surface-a border border-border">
              <p className="text-sm font-bold text-danger mb-1">🗑 Permanent Deletion</p>
              <p className="text-sm text-text">
                Lab <strong>{labName}</strong> will be permanently removed. This cannot be undone.
              </p>
              <p className="text-sm text-text-2 mt-1">
                This will fail if the lab still has any test records attached. Remove all tests from
                this lab first.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="md"
                fullWidth
                loading={isPending}
                onClick={() => void handleConfirmDelete()}
              >
                Delete Permanently
              </Button>
              <Button variant="ghost" size="md" fullWidth onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function LabTestPriceRow({
  labId,
  labTest,
  onRemove,
  onDelete,
}: {
  labId: string;
  labTest: LabTestDto;
  onRemove: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const toast = useToast();
  const [price, setPrice] = useState(String(labTest.price_usd));
  const [turnaround, setTurnaround] = useState(String(labTest.typical_turnaround_days));
  const [vials, setVials] = useState(String(labTest.vials_required ?? 1));
  const [isPending, setIsPending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUpdate = async (): Promise<void> => {
    setIsPending(true);
    try {
      await labsApi.updateTest(labId, labTest.test_id, {
        price_usd: Number(price),
        typical_turnaround_days: Number(turnaround),
        vials_required: Number(vials) || 1,
      });
      toast.success('Test updated');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update test');
    } finally {
      setIsPending(false);
    }
  };

  const { mutateAsync: reactivateTest } = useReactivateLabTest();

  const handleReactivate = async (): Promise<void> => {
    try {
      await reactivateTest({ labId, testId: labTest.test_id });
      toast.success('Test reactivated');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to reactivate test');
    }
  };

  const isInactive = !labTest.is_active;

  return (
    <>
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
          isInactive ? 'bg-surface-a opacity-50' : 'bg-surface-a'
        }`}
      >
        <div className="flex-1 min-w-0" title={labTest.test_name}>
          <p className="text-xs font-medium text-text truncate">
            {labTest.test_name}
            {isInactive && <span className="ml-1 text-text-3">(Disabled)</span>}
          </p>
        </div>
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={isInactive}
          className="w-16 rounded-lg border border-border px-2 py-1 text-xs text-text bg-surface min-h-[32px] disabled:opacity-50"
          title="Price (USD)"
        />
        <input
          type="number"
          value={turnaround}
          onChange={(e) => setTurnaround(e.target.value)}
          disabled={isInactive}
          className="w-14 rounded-lg border border-border px-2 py-1 text-xs text-text bg-surface min-h-[32px] disabled:opacity-50"
          title="Turnaround days"
        />
        <input
          type="number"
          min="1"
          value={vials}
          onChange={(e) => setVials(e.target.value)}
          disabled={isInactive}
          className="w-12 rounded-lg border border-border px-2 py-1 text-xs text-text bg-surface min-h-[32px] disabled:opacity-50"
          title="Vials required"
        />
        <Button
          variant="ghost"
          size="sm"
          loading={isPending}
          disabled={isInactive}
          onClick={() => void handleUpdate()}
        >
          Save
        </Button>
        {isInactive ? (
          <>
            <button
              type="button"
              onClick={() => void handleReactivate()}
              className="text-primary text-xs font-medium min-h-[32px] px-2"
            >
              Reactivate
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-danger text-xs font-medium min-h-[32px] px-2"
            >
              Delete
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onRemove}
            className="text-danger text-xs font-medium min-h-[32px] px-2"
          >
            Disable
          </button>
        )}
      </div>

      {showDeleteConfirm && (
        <Modal isOpen title="Delete Lab Test" onClose={() => setShowDeleteConfirm(false)}>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-surface-a border border-border">
              <p className="text-sm font-bold text-danger mb-1">🗑 Permanent Deletion</p>
              <p className="text-sm text-text">
                <strong>{labTest.test_name}</strong> will be permanently removed from this lab. This
                cannot be undone. The test will become available to re-add with fresh pricing.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm font-bold text-warning mb-1">⚠️ Campaign guard</p>
              <p className="text-sm text-text-2">
                Deletion is blocked if any campaign has requested this test at this lab.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="danger" size="md" fullWidth onClick={onDelete}>
                Delete Permanently
              </Button>
              <Button
                variant="ghost"
                size="md"
                fullWidth
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// Fee Sweep tab
// ─── VendorsTab ───────────────────────────────────────────────────────────────

function VendorsTab(): React.ReactElement {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorWebsite, setNewVendorWebsite] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const { data: vendors = [], isLoading } = useAllVendors(statusFilter || undefined);
  const { mutateAsync: createVendor, isPending: createPending } = useCreateVendor();
  const { mutateAsync: reviewVendor, isPending: reviewPending } = useReviewVendor();
  const { mutateAsync: reinstateVendor } = useReinstateVendor();
  const { mutateAsync: deleteVendor } = useDeleteVendor();

  const handleCreate = async (): Promise<void> => {
    if (!newVendorName.trim()) return;
    try {
      await createVendor({
        name: newVendorName.trim(),
        website: newVendorWebsite.trim() || undefined,
      });
      toast.success(`${newVendorName} created and approved`);
      setNewVendorName('');
      setNewVendorWebsite('');
      setShowCreate(false);
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed to create vendor'));
    }
  };

  const handleApprove = async (v: VendorDto): Promise<void> => {
    try {
      await reviewVendor({ id: v.id, dto: { status: 'approved' } });
      toast.success(`${v.name} approved`);
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed'));
    }
  };

  const handleReject = async (v: VendorDto): Promise<void> => {
    try {
      await reviewVendor({
        id: v.id,
        dto: { status: 'rejected', review_notes: rejectNotes || undefined },
      });
      toast.success(`${v.name} rejected`);
      setRejectingId(null);
      setRejectNotes('');
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed'));
    }
  };

  const handleReinstate = async (v: VendorDto): Promise<void> => {
    try {
      await reinstateVendor(v.id);
      toast.success(`${v.name} reinstated`);
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed'));
    }
  };

  const handleDelete = async (v: VendorDto): Promise<void> => {
    if (!confirm(`Delete vendor "${v.name}"? This cannot be undone.`)) return;
    try {
      await deleteVendor(v.id);
      toast.success(`${v.name} deleted`);
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed to delete vendor'));
    }
  };

  return (
    <div>
      {/* Action bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button variant="primary" size="sm" onClick={() => setShowCreate((v) => !v)}>
          Add Vendor
        </Button>
        {(['', 'pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={[
              'px-3 py-1.5 rounded-xl border text-sm font-medium min-h-[36px]',
              statusFilter === s
                ? 'bg-primary text-white border-primary'
                : 'border-border text-text-2',
            ].join(' ')}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <Card padding="md" className="mb-4">
          <p className="text-sm font-medium text-text mb-3">New Vendor (auto-approved)</p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Name *"
              value={newVendorName}
              onChange={(e) => setNewVendorName(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            />
            <input
              type="url"
              placeholder="Website (optional)"
              value={newVendorWebsite}
              onChange={(e) => setNewVendorWebsite(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={createPending}
                onClick={() => void handleCreate()}
              >
                Create
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading && <Spinner />}
      {!isLoading && vendors.length === 0 && <EmptyState heading="No vendors found" />}

      {/* Reject notes modal */}
      {rejectingId !== null && (
        <Modal isOpen title="Reject Vendor" onClose={() => setRejectingId(null)}>
          <div className="space-y-3">
            <textarea
              rows={3}
              placeholder="Review notes (optional)"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" fullWidth onClick={() => setRejectingId(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                fullWidth
                loading={reviewPending}
                onClick={() => {
                  const v = vendors.find((x) => x.id === rejectingId);
                  if (v) void handleReject(v);
                }}
              >
                Confirm Reject
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <div className="space-y-3">
        {vendors.map((v) => (
          <Card key={v.id} padding="sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-text">{v.name}</p>
                {v.website && <p className="text-xs text-text-2">{v.website}</p>}
                {v.country && <p className="text-xs text-text-2">{v.country}</p>}
                <p className="text-xs text-text-3 mt-0.5">
                  {v.status === 'approved'
                    ? '✓ Verified'
                    : v.status === 'rejected'
                      ? '✗ Rejected'
                      : '⚠ Pending'}
                </p>
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end shrink-0">
                {v.status === 'pending' && (
                  <>
                    <Button variant="primary" size="sm" onClick={() => void handleApprove(v)}>
                      Approve
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRejectingId(v.id)}>
                      Reject
                    </Button>
                  </>
                )}
                {v.status === 'approved' && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => void handleReject(v)}>
                      Suspend
                    </Button>
                  </>
                )}
                {v.status === 'rejected' && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => void handleReinstate(v)}>
                      Reinstate
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => void handleDelete(v)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── PeptidesTab ─────────────────────────────────────────────────────────────

function PeptidesTab(): React.ReactElement {
  const toast = useToast();
  const [showUnreviewed, setShowUnreviewed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAliases, setNewAliases] = useState('');

  const { data: peptides = [], isLoading } = useAllPeptides(showUnreviewed);
  const { mutateAsync: createPeptide, isPending: createPending } = useCreatePeptide();
  const { mutateAsync: approvePeptide } = useApprovePeptide();
  const { mutateAsync: rejectPeptide } = useRejectPeptide();
  const { mutateAsync: disablePeptide } = useDisablePeptide();
  const { mutateAsync: enablePeptide } = useEnablePeptide();
  const { mutateAsync: deletePeptide } = useDeletePeptide();

  const handleCreate = async (): Promise<void> => {
    if (!newName.trim()) return;
    try {
      await createPeptide({
        name: newName.trim(),
        aliases: newAliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
      });
      toast.success(`${newName} created`);
      setNewName('');
      setNewAliases('');
      setShowCreate(false);
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed'));
    }
  };

  const handleApprove = async (p: PeptideDto): Promise<void> => {
    try {
      await approvePeptide(p.id);
      toast.success(`${p.name} approved`);
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed'));
    }
  };

  const handleReject = async (p: PeptideDto): Promise<void> => {
    if (!confirm(`Reject and delete "${p.name}"?`)) return;
    try {
      await rejectPeptide(p.id);
      toast.success(`${p.name} rejected`);
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed'));
    }
  };

  const handleDisable = async (p: PeptideDto): Promise<void> => {
    try {
      await disablePeptide(p.id);
      toast.success(`${p.name} disabled`);
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed'));
    }
  };

  const handleEnable = async (p: PeptideDto): Promise<void> => {
    try {
      await enablePeptide(p.id);
      toast.success(`${p.name} enabled`);
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed'));
    }
  };

  const handleDelete = async (p: PeptideDto): Promise<void> => {
    if (!confirm(`Delete peptide "${p.name}"?`)) return;
    try {
      await deletePeptide(p.id);
      toast.success(`${p.name} deleted`);
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed to delete — peptide may be in use'));
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button variant="primary" size="sm" onClick={() => setShowCreate((v) => !v)}>
          Add Peptide
        </Button>
        <button
          type="button"
          onClick={() => setShowUnreviewed((v) => !v)}
          className={[
            'px-3 py-1.5 rounded-xl border text-sm font-medium min-h-[36px]',
            showUnreviewed
              ? 'bg-amber-100 border-amber-300 text-amber-800'
              : 'border-border text-text-2',
          ].join(' ')}
        >
          {showUnreviewed ? '⚠ Show Unreviewed' : 'All Active'}
        </button>
      </div>

      {showCreate && (
        <Card padding="md" className="mb-4">
          <p className="text-sm font-medium text-text mb-3">New Peptide (auto-approved)</p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Name *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            />
            <input
              type="text"
              placeholder="Aliases (comma-separated, optional)"
              value={newAliases}
              onChange={(e) => setNewAliases(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={createPending}
                onClick={() => void handleCreate()}
              >
                Create
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading && <Spinner />}
      {!isLoading && peptides.length === 0 && <EmptyState heading="No peptides found" />}

      <div className="space-y-3">
        {peptides.map((p) => (
          <Card key={p.id} padding="sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-text">{p.name}</p>
                {p.aliases.length > 0 && (
                  <p className="text-xs text-text-2">{p.aliases.join(', ')}</p>
                )}
                {p.description !== null && (
                  <p className="text-xs text-text-3 mt-0.5 line-clamp-1" title={p.description}>
                    {p.description}
                  </p>
                )}
                <p className="text-xs text-text-3 mt-0.5">
                  {p.is_active ? '✓ Active' : '⚠ Unreviewed / Disabled'}
                </p>
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end shrink-0">
                {!p.is_active && (
                  <>
                    <Button variant="primary" size="sm" onClick={() => void handleApprove(p)}>
                      Approve
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => void handleReject(p)}>
                      Reject
                    </Button>
                  </>
                )}
                {p.is_active && (
                  <Button variant="ghost" size="sm" onClick={() => void handleDisable(p)}>
                    Disable
                  </Button>
                )}
                {!p.is_active && p.approved_at !== null && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => void handleEnable(p)}>
                      Enable
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => void handleDelete(p)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface SweepForm {
  destination_address: string;
}

function FeeSweepTab(): React.ReactElement {
  const toast = useToast();
  const { mutateAsync: sweepFees, isPending } = useAdminFeeSweep();
  const { data: configs } = useAdminConfig();
  const defaultSweepWallet = configs?.find((c) => c.config_key === 'default_sweep_wallet');
  const defaultAddress =
    defaultSweepWallet &&
    typeof defaultSweepWallet.config_value === 'object' &&
    defaultSweepWallet.config_value !== null &&
    'address' in defaultSweepWallet.config_value
      ? String((defaultSweepWallet.config_value as Record<string, unknown>).address)
      : '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SweepForm>({
    defaultValues: { destination_address: defaultAddress },
  });

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
          {defaultAddress && <p className="text-xs text-text-3 mt-1">Default from config</p>}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {campaigns.map((c) => (
              <AdminCampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'users',
      label: 'Users',
      content: <UsersTab />,
    },
    {
      id: 'labs',
      label: 'Labs',
      content: <LabsTab />,
    },
    {
      id: 'vendors',
      label: 'Vendors',
      content: <VendorsTab />,
    },
    {
      id: 'peptides',
      label: 'Peptides',
      content: <PeptidesTab />,
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
