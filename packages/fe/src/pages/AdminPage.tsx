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
  const { mutateAsync: refundCampaign, isPending: refundPending } = useAdminRefundCampaign();
  const { mutateAsync: hideCampaign, isPending: hidePending } = useAdminHideCampaign();

  const handleRefund = async (): Promise<void> => {
    if (!confirm('Force-refund this campaign? This cannot be undone.')) return;
    try {
      await refundCampaign({ id: campaign.id, dto: { reason: 'Admin force-refund' } });
      toast.success('Campaign refunded');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Refund failed');
    }
  };

  const isHidden = false; // We track hidden state via server; optimistic shown here

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
      </Card>
      {selectedCoa && <VerifyCoaModal coa={selectedCoa} onClose={() => setSelectedCoa(null)} />}
    </>
  );
}

// Config tab
function ConfigTab(): React.ReactElement {
  const { data: configs, isLoading } = useAdminConfig();
  const toast = useToast();

  if (isLoading) return <Spinner />;
  if (!configs || configs.length === 0) {
    return <EmptyState heading="No config found" />;
  }

  return (
    <div className="space-y-3">
      {configs.map((cfg) => (
        <Card key={cfg.id} padding="md">
          <p className="font-bold text-sm text-text mb-1">{cfg.config_key}</p>
          {cfg.description && <p className="text-xs text-text-2 mb-2">{cfg.description}</p>}
          <pre className="text-xs bg-surface-a rounded-lg p-2 overflow-x-auto">
            {JSON.stringify(cfg.config_value, null, 2)}
          </pre>
          <p className="text-xs text-text-3 mt-1">Updated: {cfg.updated_at}</p>
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                toast.info(`Edit for "${cfg.config_key}" — contact dev team`);
              }}
            >
              Edit (contact dev)
            </Button>
          </div>
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
          {/* Filters */}
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
        <Tabs tabs={tabs} defaultTab="campaigns" />
      </PageContainer>
    </AppShell>
  );
}
