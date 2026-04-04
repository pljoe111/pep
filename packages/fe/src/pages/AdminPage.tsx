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
import type { CampaignDetailDto, CoaDto, LabDetailDto, LabTestDto } from 'api-client';
import { labsApi, testsApi } from '../api/apiClient';
import { useLabs, useTests } from '../api/hooks/useLabs';

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
  const { data: labsResp, isLoading: labsLoading } = useLabs(false);
  const { data: testsResp, isLoading: testsLoading } = useTests();
  const labs = labsResp?.data ?? [];
  const tests = testsResp ?? [];
  const [selectedLab, setSelectedLab] = useState<LabDetailDto | null>(null);
  const [showCreateLab, setShowCreateLab] = useState(false);
  const [showCreateTest, setShowCreateTest] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-2">
        <Button variant="primary" size="sm" onClick={() => setShowCreateLab(true)}>
          Add Lab
        </Button>
        <Button variant="primary" size="sm" onClick={() => setShowCreateTest(true)}>
          Add Test
        </Button>
      </div>

      {showCreateLab && <CreateLabModal onClose={() => setShowCreateLab(false)} />}
      {showCreateTest && <CreateTestModal onClose={() => setShowCreateTest(false)} />}

      {labsLoading && <Spinner />}
      {!labsLoading && labs.length === 0 && <EmptyState heading="No labs found" />}
      {!labsLoading && labs.length > 0 && (
        <div className="space-y-3">
          {labs.map((lab) => (
            <Card key={lab.id} padding="md">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-bold text-sm text-text">{lab.name}</h4>
                  <p className="text-xs text-text-2">{lab.country}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={lab.is_approved ? 'green' : 'amber'}>
                    {lab.is_approved ? 'Approved' : 'Pending'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void setSelectedLab(lab as unknown as LabDetailDto)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedLab && <EditLabModal lab={selectedLab} onClose={() => setSelectedLab(null)} />}

      {testsLoading && <Spinner />}
      {!testsLoading && tests.length > 0 && (
        <Card padding="md">
          <h3 className="font-bold text-base mb-3">Test Catalog</h3>
          <div className="space-y-2">
            {tests.map((test) => (
              <div
                key={test.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-text">{test.name}</p>
                  <p className="text-xs text-text-2">{test.description}</p>
                </div>
                <Badge variant={test.is_active ? 'green' : 'gray'}>
                  {test.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function CreateLabModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const toast = useToast();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleCreate = async (): Promise<void> => {
    if (!name || !country) {
      toast.error('Name and country are required');
      return;
    }
    setIsPending(true);
    try {
      await labsApi.create({
        name,
        country,
        phone_number: phoneNumber || undefined,
        address: address || undefined,
      });
      toast.success('Lab created');
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create lab');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal isOpen title="Create Lab" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="lab-name" className="text-sm font-medium text-text block mb-1">
            Name *
          </label>
          <input
            id="lab-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>
        <div>
          <label htmlFor="lab-country" className="text-sm font-medium text-text block mb-1">
            Country *
          </label>
          <input
            id="lab-country"
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>
        <div>
          <label htmlFor="lab-phone" className="text-sm font-medium text-text block mb-1">
            Phone (optional)
          </label>
          <input
            id="lab-phone"
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>
        <div>
          <label htmlFor="lab-address" className="text-sm font-medium text-text block mb-1">
            Address (optional)
          </label>
          <input
            id="lab-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
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

function CreateTestModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [uspCode, setUspCode] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleCreate = async (): Promise<void> => {
    if (!name || !description) {
      toast.error('Name and description are required');
      return;
    }
    setIsPending(true);
    try {
      await testsApi.createTest({ name, description, usp_code: uspCode || undefined });
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

function EditLabModal({
  lab,
  onClose,
}: {
  lab: LabDetailDto;
  onClose: () => void;
}): React.ReactElement {
  const toast = useToast();
  const [labName, setLabName] = useState(lab.name);
  const [country, setCountry] = useState(lab.country);
  const [phoneNumber, setPhoneNumber] = useState(lab.phone_number ?? '');
  const [address, setAddress] = useState(lab.address ?? '');
  const [isPending, setIsPending] = useState(false);

  const handleUpdate = async (): Promise<void> => {
    setIsPending(true);
    try {
      await labsApi.update(lab.id, {
        name: labName,
        country,
        phone_number: phoneNumber || undefined,
        address: address || undefined,
      });
      toast.success('Lab updated');
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update lab');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal isOpen title={`Edit Lab: ${lab.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="edit-lab-name" className="text-sm font-medium text-text block mb-1">
            Name
          </label>
          <input
            id="edit-lab-name"
            type="text"
            value={labName}
            onChange={(e) => setLabName(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>
        <div>
          <label htmlFor="edit-lab-country" className="text-sm font-medium text-text block mb-1">
            Country
          </label>
          <input
            id="edit-lab-country"
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>
        <div>
          <label htmlFor="edit-lab-phone" className="text-sm font-medium text-text block mb-1">
            Phone
          </label>
          <input
            id="edit-lab-phone"
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>
        <div>
          <label htmlFor="edit-lab-address" className="text-sm font-medium text-text block mb-1">
            Address
          </label>
          <input
            id="edit-lab-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>

        {/* Lab Tests */}
        <div className="pt-2 border-t border-border">
          <h4 className="text-sm font-semibold text-text mb-2">Lab Tests & Prices</h4>
          <div className="space-y-2">
            {(lab.tests ?? []).map((lt) => (
              <LabTestPriceEditor key={lt.test_id} labId={lab.id} labTest={lt} />
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="md"
            fullWidth
            loading={isPending}
            onClick={() => void handleUpdate()}
          >
            Save
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function LabTestPriceEditor({
  labId,
  labTest,
}: {
  labId: string;
  labTest: LabTestDto;
}): React.ReactElement {
  const toast = useToast();
  const [price, setPrice] = useState(String(labTest.price_usd));
  const [turnaround, setTurnaround] = useState(String(labTest.typical_turnaround_days));
  const [isPending, setIsPending] = useState(false);

  const handleUpdate = async (): Promise<void> => {
    setIsPending(true);
    try {
      await labsApi.updateTest(labId, labTest.test_id, {
        price_usd: Number(price),
        typical_turnaround_days: Number(turnaround),
      });
      toast.success('Test price updated');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update test price');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <p className="text-xs font-medium text-text">{labTest.test_name}</p>
      </div>
      <input
        type="number"
        step="0.01"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-20 rounded-xl border border-border px-2 py-1 text-xs text-text bg-surface min-h-[36px]"
        placeholder="Price"
      />
      <input
        type="number"
        value={turnaround}
        onChange={(e) => setTurnaround(e.target.value)}
        className="w-16 rounded-xl border border-border px-2 py-1 text-xs text-text bg-surface min-h-[36px]"
        placeholder="Days"
      />
      <Button variant="primary" size="sm" loading={isPending} onClick={() => void handleUpdate()}>
        Save
      </Button>
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
