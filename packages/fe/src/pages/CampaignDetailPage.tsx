import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { ReactionType, CampaignDetailDto } from 'api-client';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { Badge } from '../components/ui/Badge';
import { campaignStatusVariant, campaignStatusLabel } from '../lib/badgeUtils';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Sheet } from '../components/ui/Sheet';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Spinner } from '../components/ui/Spinner';
import { Tabs } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/EmptyState';
import { Avatar } from '../components/ui/Avatar';
import { useToast } from '../hooks/useToast';
import {
  useCampaignDetail,
  useCampaignReactions,
  useCampaignCoas,
  useCampaignUpdates,
  useCampaignContributions,
  useAddReaction,
  useRemoveReaction,
  useContribute,
  useLockCampaign,
  useShipSamples,
  useAddCampaignUpdate,
  useUploadCoa,
} from '../api/hooks/useCampaigns';
import { useWalletBalance } from '../api/hooks/useWallet';
import { useAuth } from '../hooks/useAuth';
import {
  formatUSD,
  formatPercent,
  formatTimeRemaining,
  formatDate,
  formatRelativeDate,
} from '../lib/formatters';

const REACTION_EMOJIS: Record<ReactionType, string> = {
  thumbs_up: '👍',
  rocket: '🚀',
  praising_hands: '🙌',
  mad: '😤',
  fire: '🔥',
};

const REACTION_TYPES: ReactionType[] = ['thumbs_up', 'rocket', 'praising_hands', 'mad', 'fire'];

function ContributeSheet({
  campaignId,
  isOpen,
  onClose,
}: {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
}): React.ReactElement {
  const [amount, setAmount] = useState('');
  const { data: balance } = useWalletBalance();
  const { mutateAsync: contribute, isPending } = useContribute(campaignId);
  const toast = useToast();

  const handleSubmit = async (): Promise<void> => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    try {
      await contribute({ amount: parsedAmount, currency: 'usdt' });
      toast.success('Contribution submitted!');
      onClose();
      setAmount('');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Contribution failed');
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Contribute">
      <div className="space-y-5">
        {balance && (
          <div className="bg-primary-l rounded-xl p-3 text-sm">
            <span className="text-text-2">Your balance: </span>
            <span className="font-bold text-primary">{formatUSD(balance.balance ?? 0)}</span>
          </div>
        )}

        <div>
          <label htmlFor="contribute-amount" className="text-sm font-medium text-text block mb-2">
            Amount (USD)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-2 font-medium">
              $
            </span>
            <input
              id="contribute-amount"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-border pl-8 pr-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
            />
          </div>
        </div>

        <div className="flex gap-3 mb-1 sm:mb-6">
          <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isPending}
            onClick={() => void handleSubmit()}
          >
            Contribute
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function LockCampaignSheet({
  campaignId,
  campaign,
  isOpen,
  onClose,
}: {
  campaignId: string;
  campaign: CampaignDetailDto;
  isOpen: boolean;
  onClose: () => void;
}): React.ReactElement {
  const { mutateAsync: lockCampaign, isPending } = useLockCampaign(campaignId);
  const toast = useToast();

  const effectiveThreshold =
    campaign.effective_lock_threshold_usd ?? campaign.funding_threshold_usd;
  const hasMetFundingThreshold = campaign.current_funding_usd >= effectiveThreshold;
  const isNotFlagged = !campaign.is_flagged_for_review;

  const requirements = [
    {
      met: hasMetFundingThreshold,
      label: `Funding threshold met`,
      detail: `Need ${formatUSD(effectiveThreshold)}, currently have ${formatUSD(campaign.current_funding_usd)}`,
    },
    {
      met: isNotFlagged,
      label: 'Campaign not flagged for review',
      detail: campaign.is_flagged_for_review
        ? (campaign.flagged_reason ?? 'Campaign is flagged')
        : null,
    },
  ];

  const allRequirementsMet = requirements.every((r) => r.met);

  const handleLock = async (): Promise<void> => {
    try {
      await lockCampaign();
      toast.success('Campaign locked successfully');
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to lock campaign');
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Lock Campaign">
      <div className="space-y-5">
        {/* Warning banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-warning font-medium mb-1">This action cannot be undone.</p>
          <p className="text-xs text-text-2">
            Locking this campaign will close it to further contributions. Current funding will be
            preserved and contributors will be refunded if the goal is not met.
          </p>
        </div>

        {/* Requirements checklist */}
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">Requirements</h3>
          <div className="space-y-3">
            {requirements.map((req, index) => (
              <div key={index} className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    req.met ? 'bg-success' : 'bg-border'
                  }`}
                >
                  {req.met ? (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg
                      className="w-3 h-3 text-text-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${req.met ? 'text-text' : 'text-text-2'}`}>
                    {req.label}
                  </p>
                  {!req.met && req.detail && (
                    <p className="text-xs text-danger mt-0.5">{req.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current funding summary */}
        <Card padding="sm">
          <div className="flex justify-between text-sm">
            <span className="text-text-2">Current funding</span>
            <span className="font-bold text-text">{formatUSD(campaign.current_funding_usd)}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-text-2">Campaign threshold</span>
            <span className="font-bold text-text">{formatUSD(campaign.funding_threshold_usd)}</span>
          </div>
          {effectiveThreshold < campaign.funding_threshold_usd && (
            <div className="flex justify-between text-sm mt-1">
              <span className="text-text-2">Effective threshold</span>
              <span className="font-bold text-primary">
                {formatUSD(effectiveThreshold)}{' '}
                <span className="text-xs font-normal text-text-3">(platform minimum)</span>
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm mt-1">
            <span className="text-text-2">Status</span>
            <Badge variant={campaignStatusVariant(campaign.status)}>
              {campaignStatusLabel(campaign.status)}
            </Badge>
          </div>
        </Card>

        {/* Action buttons */}
        <div className="flex gap-3 mb-1 sm:mb-6">
          <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="lg"
            fullWidth
            disabled={!allRequirementsMet}
            loading={isPending}
            onClick={() => void handleLock()}
          >
            {allRequirementsMet ? 'Lock Campaign' : 'Requirements not met'}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function ShipSamplesSheet({
  campaignId,
  isOpen,
  onClose,
}: {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
}): React.ReactElement {
  const { mutateAsync: shipSamples, isPending } = useShipSamples(campaignId);
  const toast = useToast();

  const handleShip = async (): Promise<void> => {
    try {
      await shipSamples();
      toast.success('Samples marked as shipped');
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark samples as shipped');
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Ship Samples">
      <div className="space-y-5">
        <div className="bg-primary-l rounded-xl p-4">
          <p className="text-sm text-primary font-medium mb-1">Confirm shipment</p>
          <p className="text-xs text-text-2">
            This will mark all samples as shipped and notify contributors. Make sure all samples
            have been sent to the lab before confirming.
          </p>
        </div>

        <div className="flex gap-3 mb-1 sm:mb-6">
          <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isPending}
            onClick={() => void handleShip()}
          >
            Confirm Shipment
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function AddUpdateSheet({
  campaignId,
  isOpen,
  onClose,
}: {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
}): React.ReactElement {
  const [content, setContent] = useState('');
  const { mutateAsync: addUpdate, isPending } = useAddCampaignUpdate(campaignId);
  const toast = useToast();

  const handleSubmit = async (): Promise<void> => {
    if (!content.trim()) {
      toast.error('Please enter update content');
      return;
    }
    try {
      await addUpdate({ content: content.trim() });
      toast.success('Update posted');
      onClose();
      setContent('');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to add update');
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Add Update">
      <div className="space-y-5">
        <div>
          <label htmlFor="update-content" className="text-sm font-medium text-text block mb-2">
            Update content
          </label>
          <textarea
            id="update-content"
            placeholder="Share progress with your supporters..."
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none min-h-[44px]"
          />
        </div>

        <div className="flex gap-3 mb-1 sm:mb-6">
          <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isPending}
            disabled={!content.trim()}
            onClick={() => void handleSubmit()}
          >
            Post Update
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function UploadCoaSheet({
  campaignId,
  samples,
  isOpen,
  onClose,
}: {
  campaignId: string;
  samples: CampaignDetailDto['samples'];
  isOpen: boolean;
  onClose: () => void;
}): React.ReactElement {
  const [selectedSample, setSelectedSample] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: uploadCoa, isPending } = useUploadCoa(campaignId);
  const toast = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Only PDF files are accepted');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async (): Promise<void> => {
    if (!selectedSample) {
      toast.error('Please select a sample');
      return;
    }
    if (!selectedFile) {
      toast.error('Please select a PDF file');
      return;
    }
    try {
      await uploadCoa({ sampleId: selectedSample, file: selectedFile });
      toast.success('COA uploaded successfully');
      onClose();
      setSelectedSample('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload COA');
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Upload COA">
      <div className="space-y-5">
        <div>
          <label htmlFor="coa-sample" className="text-sm font-medium text-text block mb-2">
            Select sample
          </label>
          <select
            id="coa-sample"
            value={selectedSample}
            onChange={(e) => setSelectedSample(e.target.value)}
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
          >
            <option value="">Choose a sample...</option>
            {(samples ?? []).map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.sample_label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="coa-file" className="text-sm font-medium text-text block mb-2">
            COA PDF file
          </label>
          <input
            ref={fileInputRef}
            id="coa-file"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
          />
          {selectedFile && (
            <p className="text-xs text-text-2 mt-2">
              Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
            </p>
          )}
        </div>

        <div className="flex gap-3 mb-1 sm:mb-6">
          <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isPending}
            disabled={!selectedSample || !selectedFile}
            onClick={() => void handleUpload()}
          >
            Upload COA
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export function CampaignDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [showContributeSheet, setShowContributeSheet] = useState(false);
  const [showLockSheet, setShowLockSheet] = useState(false);
  const [showShipSheet, setShowShipSheet] = useState(false);
  const [showAddUpdateSheet, setShowAddUpdateSheet] = useState(false);
  const [showUploadCoaSheet, setShowUploadCoaSheet] = useState(false);
  const toast = useToast();

  const campaignId = id ?? '';

  const { data: campaign, isLoading, isError } = useCampaignDetail(campaignId);

  const { data: reactions, refetch: refetchReactions } = useCampaignReactions(campaignId);
  const { data: coas } = useCampaignCoas(campaignId);
  const { data: updatesData } = useCampaignUpdates(campaignId);
  const { data: contributionsResp } = useCampaignContributions(campaignId);

  const { mutateAsync: addReaction } = useAddReaction(campaignId);
  const { mutateAsync: removeReaction } = useRemoveReaction(campaignId);

  const handleReaction = async (type: ReactionType): Promise<void> => {
    if (!isAuthenticated) {
      void navigate('/login');
      return;
    }
    try {
      if (campaign?.my_reaction === type) {
        await removeReaction(type);
      } else {
        await addReaction({ reaction_type: type });
      }
      void refetchReactions();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to react');
    }
  };

  const handleContributeClick = (): void => {
    if (!isAuthenticated) {
      void navigate('/login');
      return;
    }
    if (!user?.email_verified) {
      toast.info('Please verify your email before contributing');
      return;
    }
    setShowContributeSheet(true);
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageContainer className="py-6 flex items-center justify-center min-h-[60vh]">
          <Spinner size="lg" />
        </PageContainer>
      </AppShell>
    );
  }

  if (isError || !campaign) {
    return (
      <AppShell>
        <PageContainer className="py-6">
          <EmptyState
            heading="Campaign not found"
            subtext="This campaign doesn't exist or has been removed."
            ctaLabel="Go Home"
            onCta={() => void navigate('/')}
          />
        </PageContainer>
      </AppShell>
    );
  }

  const progress = campaign.funding_progress_percent ?? 0;
  const updates = updatesData?.data ?? [];
  const contributions = contributionsResp?.data ?? [];

  // Check if current user is the campaign creator
  const isCreator = isAuthenticated && user?.id === campaign.creator?.id;

  // Creator action availability based on campaign status
  // Lock button shows for creators in 'created' status; sheet shows requirements
  const isLockableStatus = isCreator && campaign.status === 'created';
  const canShipSamples = isCreator && campaign.status === 'funded';
  const canAddUpdate = isCreator;
  const canUploadCoa =
    isCreator &&
    (campaign.samples ?? []).length > 0 &&
    (campaign.status === 'funded' ||
      campaign.status === 'samples_sent' ||
      campaign.status === 'results_published');

  // Non-creators can contribute if campaign is open
  const canContribute =
    !isCreator &&
    (campaign.status === 'created' || campaign.status === 'funded') &&
    !campaign.is_flagged_for_review;

  const tabContent = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-4">
          <Card padding="md">
            <h3 className="font-bold text-base mb-2">About</h3>
            <p className="text-text-2 text-sm whitespace-pre-wrap">{campaign.description}</p>
          </Card>
          {campaign.is_itemized && campaign.itemization_data && (
            <Card padding="md">
              <h3 className="font-bold text-base mb-2">Cost Breakdown</h3>
              <p className="text-sm text-text-2">Itemized breakdown available</p>
            </Card>
          )}
        </div>
      ),
    },
    {
      id: 'samples',
      label: 'Samples',
      content: (
        <div className="space-y-3">
          {(campaign.samples ?? []).length === 0 && (
            <EmptyState heading="No samples added" subtext="Samples will appear here" />
          )}
          {(campaign.samples ?? []).map((sample) => (
            <Card key={sample.id} padding="md">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-bold text-sm">{sample.sample_label}</h4>
                {sample.target_lab && (
                  <span className="text-xs text-text-2 bg-surface-a px-2 py-1 rounded-lg">
                    {sample.target_lab.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-2 mb-1">Vendor: {sample.vendor_name}</p>
              <p className="text-xs text-text-2 mb-2">{sample.physical_description}</p>
              {(sample.claims ?? []).map((claim) => (
                <div key={claim.id} className="text-xs text-text-2 mb-1">
                  {claim.claim_type === 'mass'
                    ? `Claim: ${claim.mass_amount ?? ''} ${claim.mass_unit ?? ''}`
                    : `Claim: ${claim.other_description ?? ''}`}
                </div>
              ))}
              {(sample.tests ?? []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(sample.tests ?? []).map((test) => (
                    <span
                      key={test.id}
                      className="text-xs bg-primary-l text-primary px-2 py-0.5 rounded-full"
                    >
                      {test.name}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      ),
    },
    {
      id: 'results',
      label: 'Results',
      content: (
        <div className="space-y-3">
          {(coas ?? []).length === 0 && (
            <EmptyState
              heading="No results yet"
              subtext="Certificate of Analysis documents will appear here when uploaded"
            />
          )}
          {(coas ?? []).map((coa) => (
            <Card key={coa.id} padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{coa.file_name}</p>
                  <p className="text-xs text-text-2">{formatDate(coa.uploaded_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={coa.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary font-medium underline min-h-[44px] flex items-center"
                  >
                    View PDF
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ),
    },
    {
      id: 'updates',
      label: 'Updates',
      content: (
        <div className="space-y-3">
          {updates.length === 0 && (
            <EmptyState heading="No updates yet" subtext="Creator updates will appear here" />
          )}
          {updates.map((update) => (
            <Card key={update.id} padding="md">
              <p className="text-sm text-text whitespace-pre-wrap">{update.content}</p>
              <p className="text-xs text-text-3 mt-2">{formatRelativeDate(update.created_at)}</p>
            </Card>
          ))}
        </div>
      ),
    },
    {
      id: 'funding',
      label: 'Funding',
      content: (
        <div className="space-y-3">
          {contributions.length === 0 && (
            <EmptyState
              heading="No contributions yet"
              subtext="Be the first to support this campaign!"
            />
          )}
          {contributions.map((contribution) => (
            <Card key={contribution.id} padding="sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar username={contribution.contributor.username} size="sm" />
                  <div>
                    <Link
                      to={`/users/${contribution.contributor.id}`}
                      className="font-semibold text-sm text-text hover:text-primary transition-colors"
                    >
                      {contribution.contributor.username ?? 'Anonymous'}
                    </Link>
                    <p className="text-xs text-text-3">
                      {formatRelativeDate(contribution.contributed_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-primary">
                    {formatUSD(contribution.amount_usd)}
                  </p>
                  <Badge variant="teal">{contribution.status}</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <PageContainer className="py-4 pb-24">
        {/* Back button */}
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="flex items-center gap-1 text-sm text-text-2 mb-4 min-h-[44px]"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </button>

        {/* Hero */}
        <div className="mb-6">
          <div className="flex items-start gap-2 mb-3">
            <h1 className="text-2xl font-bold text-text flex-1 leading-tight">{campaign.title}</h1>
            <Badge variant={campaignStatusVariant(campaign.status)}>
              {campaignStatusLabel(campaign.status)}
            </Badge>
          </div>

          {/* Creator info */}
          <div className="flex items-center gap-2 mb-4">
            <Avatar username={campaign.creator?.username} size="sm" />
            <div>
              {campaign.creator?.id ? (
                <Link
                  to={`/users/${campaign.creator.id}`}
                  className="text-sm font-medium text-text hover:text-primary transition-colors"
                >
                  {campaign.creator.username ?? 'Anonymous'}
                </Link>
              ) : (
                <p className="text-sm font-medium text-text">
                  {campaign.creator?.username ?? 'Anonymous'}
                </p>
              )}
              {campaign.creator?.successful_campaigns !== undefined && (
                <p className="text-xs text-text-2">
                  {campaign.creator.successful_campaigns} successful campaigns
                </p>
              )}
            </div>
          </div>

          {/* Flagged warning */}
          {campaign.is_flagged_for_review && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-warning flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-warning font-medium">This campaign is under review</p>
            </div>
          )}

          {/* Creator actions — at the top for easy access */}
          {isCreator && (
            <Card padding="sm" className="mb-4">
              <h3 className="text-xs font-medium text-text-2 uppercase tracking-wide mb-3">
                Creator Actions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {isLockableStatus && (
                  <Button
                    variant="danger"
                    size="sm"
                    fullWidth
                    onClick={() => setShowLockSheet(true)}
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Lock
                  </Button>
                )}
                {canShipSamples && (
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={() => setShowShipSheet(true)}
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                    </svg>
                    Ship
                  </Button>
                )}
                {canAddUpdate && (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => setShowAddUpdateSheet(true)}
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Update
                  </Button>
                )}
                {canUploadCoa && (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => setShowUploadCoaSheet(true)}
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Upload COA
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Funding progress */}
          <Card padding="md" className="mb-4">
            <div className="mb-4">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-3xl font-extrabold text-primary">
                  {formatPercent(progress)}
                </span>
                <span className="text-sm text-text-2">funded</span>
              </div>
              <ProgressBar
                percent={progress}
                color={progress >= 100 ? 'success' : 'primary'}
                size="lg"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-base font-bold text-text">
                  {formatUSD(campaign.current_funding_usd)}
                </p>
                <p className="text-xs text-text-2">Raised</p>
              </div>
              <div>
                <p className="text-base font-bold text-text">
                  {formatUSD(campaign.funding_threshold_usd)}
                </p>
                <p className="text-xs text-text-2">Goal</p>
              </div>
              <div>
                <p className="text-base font-bold text-text">
                  {formatUSD(campaign.amount_requested_usd)}
                </p>
                <p className="text-xs text-text-2">Requested</p>
              </div>
            </div>
            {campaign.deadlines?.fundraising && (
              <p className="text-xs text-text-3 mt-3 text-center">
                {formatTimeRemaining(
                  Math.max(
                    0,
                    Math.floor(
                      (new Date(campaign.deadlines.fundraising).getTime() - Date.now()) / 1000
                    )
                  )
                )}{' '}
                remaining
              </p>
            )}
          </Card>

          {/* Reaction bar — hidden for creator */}
          {!isCreator && (
            <Card padding="sm" className="mb-4">
              <div className="flex justify-around">
                {REACTION_TYPES.map((type) => {
                  const count =
                    (reactions ?? campaign.reactions)?.[type as keyof typeof reactions] ?? 0;
                  const isActive = campaign.my_reaction === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => void handleReaction(type)}
                      className={[
                        'flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors',
                        'min-h-[44px] min-w-[44px]',
                        isActive ? 'bg-primary-l' : 'hover:bg-surface-a',
                      ].join(' ')}
                      aria-label={`${type} reaction (${count as number})`}
                      aria-pressed={isActive}
                    >
                      <span className="text-xl">{REACTION_EMOJIS[type]}</span>
                      <span
                        className={`text-xs font-semibold ${isActive ? 'text-primary' : 'text-text-2'}`}
                      >
                        {count as number}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Email verification prompt */}
        {isAuthenticated && !user?.email_verified && canContribute && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-warning font-medium">
              Verify your email to contribute to campaigns.
            </p>
          </div>
        )}

        {/* Tab content */}
        <Tabs tabs={tabContent} defaultTab="overview" />
      </PageContainer>

      {/* Sticky CTA — hidden for creator */}
      {canContribute && (
        <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 bg-gradient-to-t from-bg to-transparent pt-4">
          <Button variant="primary" size="lg" fullWidth onClick={handleContributeClick}>
            Contribute
          </Button>
        </div>
      )}

      {/* Sheets */}
      <ContributeSheet
        campaignId={campaignId}
        isOpen={showContributeSheet}
        onClose={() => setShowContributeSheet(false)}
      />
      {campaign && (
        <LockCampaignSheet
          campaignId={campaignId}
          campaign={campaign}
          isOpen={showLockSheet}
          onClose={() => setShowLockSheet(false)}
        />
      )}
      <ShipSamplesSheet
        campaignId={campaignId}
        isOpen={showShipSheet}
        onClose={() => setShowShipSheet(false)}
      />
      <AddUpdateSheet
        campaignId={campaignId}
        isOpen={showAddUpdateSheet}
        onClose={() => setShowAddUpdateSheet(false)}
      />
      <UploadCoaSheet
        campaignId={campaignId}
        samples={campaign.samples}
        isOpen={showUploadCoaSheet}
        onClose={() => setShowUploadCoaSheet(false)}
      />
    </AppShell>
  );
}
