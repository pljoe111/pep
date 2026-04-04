import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import type { CampaignListDto } from 'api-client';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useToast } from '../hooks/useToast';
import {
  useMyCampaigns,
  useUpdateCampaign,
  useDeleteCampaign,
  useCampaignDetail,
} from '../api/hooks/useCampaigns';
import { campaignStatusVariant, campaignStatusLabel } from '../lib/badgeUtils';
import { formatUSD, formatPercent } from '../lib/formatters';

// ─── Status tabs ─────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'created' },
  { label: 'Funded', value: 'funded' },
  { label: 'Active', value: 'samples_sent' },
  { label: 'Done', value: 'resolved' },
] as const;

type StatusTabValue = (typeof STATUS_TABS)[number]['value'];

// ─── Edit sheet ───────────────────────────────────────────────────────────────

interface EditForm {
  title: string;
  description: string;
}

interface EditSheetProps {
  campaignId: string;
  onClose: () => void;
}

function EditSheet({ campaignId, onClose }: EditSheetProps): React.ReactElement {
  const toast = useToast();
  const { data: detail, isLoading } = useCampaignDetail(campaignId);
  const { mutateAsync: updateCampaign, isPending } = useUpdateCampaign(campaignId);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditForm>({
    values: detail ? { title: detail.title, description: detail.description } : undefined,
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await updateCampaign({ title: data.title, description: data.description });
      toast.success('Campaign updated');
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Update failed');
    }
  });

  return (
    <Sheet isOpen title="Edit Campaign" onClose={onClose}>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <Input
            label="Title"
            required
            error={errors.title?.message}
            {...register('title', { required: 'Title required' })}
          />
          <Textarea
            label="Description"
            required
            rows={3}
            error={errors.description?.message}
            {...register('description', { required: 'Description required' })}
          />
          <div className="flex gap-3 pt-2 pb-2">
            <Button type="button" variant="secondary" size="md" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" fullWidth loading={isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

// ─── Campaign row ─────────────────────────────────────────────────────────────

interface CampaignRowProps {
  campaign: CampaignListDto;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

function CampaignRow({
  campaign,
  onEdit,
  onDelete,
  isDeleting,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
}: CampaignRowProps): React.ReactElement {
  const canEdit = campaign.status === 'created';
  const canDelete = campaign.status === 'created' && campaign.current_funding_usd === 0;

  return (
    <Card padding="md" className="mb-3">
      {/* Header row */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <Link
            to={`/campaigns/${campaign.id}`}
            className="font-bold text-text text-sm leading-tight hover:text-primary line-clamp-2"
          >
            {campaign.title}
          </Link>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={campaignStatusVariant(campaign.status)}>
              {campaignStatusLabel(campaign.status)}
            </Badge>
            {campaign.is_flagged_for_review && <Badge variant="amber">Under review</Badge>}
          </div>
        </div>
        <p className="text-sm font-bold text-primary shrink-0">
          {formatUSD(campaign.current_funding_usd)}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <ProgressBar percent={campaign.funding_progress_percent} color="primary" size="sm" />
        <p className="text-xs text-text-3 mt-1">
          {formatPercent(campaign.funding_progress_percent)} of{' '}
          {formatUSD(campaign.funding_threshold_usd)} goal (
          {formatUSD(campaign.amount_requested_usd)} requested)
        </p>
      </div>

      {/* Delete confirmation inline */}
      {confirmingDelete ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <p className="text-sm font-medium text-danger">
            Delete &quot;{campaign.title}&quot;? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" fullWidth onClick={onCancelDelete}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              fullWidth
              loading={isDeleting}
              onClick={onConfirmDelete}
              className="bg-danger hover:bg-danger"
            >
              Delete
            </Button>
          </div>
        </div>
      ) : (
        /* Actions */
        <div className="flex gap-2">
          <Link
            to={`/campaigns/${campaign.id}`}
            className="flex-1 text-center text-sm font-semibold text-primary py-2 px-3 rounded-xl border border-primary min-h-[36px] flex items-center justify-center hover:bg-primary-l transition-colors"
          >
            View
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 text-sm font-semibold text-text-2 py-2 px-3 rounded-xl border border-border min-h-[36px] hover:bg-surface-a transition-colors"
            >
              Edit
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-sm font-semibold text-danger py-2 px-3 rounded-xl border border-danger/30 min-h-[36px] hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── MyCampaignsPage ──────────────────────────────────────────────────────────

export function MyCampaignsPage(): React.ReactElement {
  const navigate = useNavigate();
  const toast = useToast();

  const [statusTab, setStatusTab] = useState<StatusTabValue>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useMyCampaigns({});
  const { mutateAsync: deleteCampaign, isPending: isDeleting } = useDeleteCampaign();

  const allCampaigns = data?.data ?? [];

  const filtered =
    statusTab === '' ? allCampaigns : allCampaigns.filter((c) => c.status === statusTab);

  const handleDelete = async (campaignId: string): Promise<void> => {
    try {
      await deleteCampaign(campaignId);
      toast.success('Campaign deleted');
      setConfirmingDeleteId(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  return (
    <AppShell>
      <PageContainer className="py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-text">My Campaigns</h1>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void navigate('/create')}
          >
            + New
          </Button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusTab(tab.value)}
              className={[
                'shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors',
                statusTab === tab.value
                  ? 'bg-primary text-white'
                  : 'bg-surface-a text-text-2 hover:bg-border',
              ].join(' ')}
            >
              {tab.label}
              {tab.value === '' && allCampaigns.length > 0 && (
                <span className="ml-1 text-xs opacity-70">({allCampaigns.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <EmptyState
            heading="No campaigns yet"
            subtext="Create your first campaign to get started."
            ctaLabel="Create Campaign"
            onCta={() => void navigate('/create')}
          />
        )}

        {filtered.map((campaign) => (
          <CampaignRow
            key={campaign.id}
            campaign={campaign}
            onEdit={() => setEditingId(campaign.id)}
            onDelete={() => setConfirmingDeleteId(campaign.id)}
            isDeleting={isDeleting && confirmingDeleteId === campaign.id}
            confirmingDelete={confirmingDeleteId === campaign.id}
            onConfirmDelete={() => void handleDelete(campaign.id)}
            onCancelDelete={() => setConfirmingDeleteId(null)}
          />
        ))}

        {/* Edit sheet */}
        {editingId !== null && (
          <EditSheet campaignId={editingId} onClose={() => setEditingId(null)} />
        )}
      </PageContainer>
    </AppShell>
  );
}
