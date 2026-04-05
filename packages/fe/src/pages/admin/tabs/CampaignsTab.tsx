import React, { useState } from 'react';
import type { CampaignDetailDto } from 'api-client';
import {
  useAdminCampaigns,
  useAdminFlagCampaign,
  useAdminHideCampaign,
  useAdminRefundCampaign,
} from '../../../api/hooks/useAdmin';
import { useDebounce } from '../../../hooks/useDebounce';
import { useToast } from '../../../hooks/useToast';
import { Spinner } from '../../../components/ui/Spinner';
import { AdminFilterBar } from '../components/shared/AdminFilterBar';
import { AdminEmptyState } from '../components/shared/AdminEmptyState';
import { CampaignRow } from '../components/campaigns/CampaignRow';
import { CampaignFlagModal } from '../components/campaigns/CampaignFlagModal';
import { CampaignRefundModal } from '../components/campaigns/CampaignRefundModal';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Created', value: 'created' },
  { label: 'Funded', value: 'funded' },
  { label: 'Samples Sent', value: 'samples_sent' },
  { label: 'Results Published', value: 'results_published' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Refunded', value: 'refunded' },
];

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

export function CampaignsTab(): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [flagModal, setFlagModal] = useState<string | null>(null);
  const [refundModal, setRefundModal] = useState<CampaignDetailDto | null>(null);

  const { data, isLoading } = useAdminCampaigns({
    status: statusFilter || undefined,
    flagged: flaggedOnly || undefined,
  });

  const flagMutation = useAdminFlagCampaign();
  const hideMutation = useAdminHideCampaign();
  const refundMutation = useAdminRefundCampaign();
  const toast = useToast();

  const campaigns: CampaignDetailDto[] = data?.data ?? [];

  const filtered = debouncedSearch
    ? campaigns.filter(
        (c) =>
          c.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          String(c.verification_code).includes(debouncedSearch)
      )
    : campaigns;

  const handleFlag = (id: string): void => {
    setFlagModal(id);
  };

  const handleUnflag = (id: string): void => {
    flagMutation.mutate(
      { id, dto: { flagged: false } },
      {
        onSuccess: () => toast.success('Flag removed'),
        onError: (e) => toast.error(extractApiError(e, 'Failed to unflag')),
      }
    );
  };

  const handleHide = (id: string): void => {
    hideMutation.mutate(
      { id, dto: { hidden: true } },
      {
        onSuccess: () => toast.success('Campaign hidden'),
        onError: (e) => toast.error(extractApiError(e, 'Failed to hide')),
      }
    );
  };

  const handleUnhide = (id: string): void => {
    hideMutation.mutate(
      { id, dto: { hidden: false } },
      {
        onSuccess: () => toast.success('Campaign unhidden'),
        onError: (e) => toast.error(extractApiError(e, 'Failed to unhide')),
      }
    );
  };

  const handleRefund = (campaign: CampaignDetailDto): void => {
    setRefundModal(campaign);
  };

  const handleApproveResolution = (_id: string): void => {
    // TODO: implement when endpoint is available
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <AdminFilterBar options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        <button
          type="button"
          onClick={() => setFlaggedOnly(!flaggedOnly)}
          className={[
            'px-3 py-2 rounded-full border text-sm font-medium min-h-[36px] transition-colors whitespace-nowrap',
            flaggedOnly
              ? 'bg-primary-l border-primary text-primary'
              : 'border-border text-text-2 hover:border-text-3',
          ].join(' ')}
        >
          Flagged Only
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by title or verification code..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-border px-4 py-3 text-sm text-text bg-surface min-h-[44px]"
      />

      {filtered.length === 0 ? (
        <AdminEmptyState message="No campaigns found" />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <CampaignRow
              key={c.id}
              campaign={c}
              onFlag={handleFlag}
              onUnflag={handleUnflag}
              onHide={handleHide}
              onUnhide={handleUnhide}
              onRefund={handleRefund}
              onApproveResolution={handleApproveResolution}
              isFlagPending={flagMutation.isPending}
              isHidePending={hideMutation.isPending}
            />
          ))}
        </div>
      )}

      {flagModal && (
        <CampaignFlagModal
          campaignId={flagModal}
          onClose={() => setFlagModal(null)}
          onConfirm={(reason) => {
            flagMutation.mutate(
              { id: flagModal, dto: { flagged: true, reason } },
              {
                onSuccess: () => {
                  toast.success('Campaign flagged');
                  setFlagModal(null);
                },
                onError: (e) => toast.error(extractApiError(e, 'Failed to flag')),
              }
            );
          }}
          isPending={flagMutation.isPending}
        />
      )}

      {refundModal && (
        <CampaignRefundModal
          campaign={refundModal}
          onClose={() => setRefundModal(null)}
          onConfirm={(reason) => {
            refundMutation.mutate(
              { id: refundModal.id, dto: { reason } },
              {
                onSuccess: () => {
                  toast.success('Campaign refunded');
                  setRefundModal(null);
                },
                onError: (e) => toast.error(extractApiError(e, 'Failed to refund')),
              }
            );
          }}
          isPending={refundMutation.isPending}
        />
      )}
    </div>
  );
}
