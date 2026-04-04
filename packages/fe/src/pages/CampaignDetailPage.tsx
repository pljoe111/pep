import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ReactionType } from 'api-client';
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
  useAddReaction,
  useRemoveReaction,
  useContribute,
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
      // Option B: unified balance — always settle as USDT on-chain
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
        {/* Unified balance display */}
        {balance && (
          <div className="bg-primary-l rounded-xl p-3 text-sm">
            <span className="text-text-2">Your balance: </span>
            <span className="font-bold text-primary">{formatUSD(balance.balance ?? 0)}</span>
          </div>
        )}

        {/* Amount input */}
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

        {/* Actions */}
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

export function CampaignDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [showContributeSheet, setShowContributeSheet] = useState(false);
  const toast = useToast();

  const campaignId = id ?? '';

  const { data: campaign, isLoading, isError } = useCampaignDetail(campaignId);

  const { data: reactions, refetch: refetchReactions } = useCampaignReactions(campaignId);
  const { data: coas } = useCampaignCoas(campaignId);
  const { data: updatesData } = useCampaignUpdates(campaignId);

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
  const canContribute =
    (campaign.status === 'created' || campaign.status === 'funded') &&
    !campaign.is_flagged_for_review;
  const updates = updatesData?.data ?? [];

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
              {/* Claims */}
              {(sample.claims ?? []).map((claim) => (
                <div key={claim.id} className="text-xs text-text-2 mb-1">
                  {claim.claim_type === 'mass'
                    ? `Claim: ${claim.mass_amount ?? ''} ${claim.mass_unit ?? ''}`
                    : `Claim: ${claim.other_description ?? ''}`}
                </div>
              ))}
              {/* Tests */}
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
              <p className="text-sm font-medium text-text">
                {campaign.creator?.username ?? 'Anonymous'}
              </p>
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

          {/* Reaction bar */}
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

      {/* Sticky CTA */}
      {canContribute && (
        <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 bg-gradient-to-t from-bg to-transparent pt-4">
          <Button variant="primary" size="lg" fullWidth onClick={handleContributeClick}>
            Contribute
          </Button>
        </div>
      )}

      {/* Contribute sheet */}
      <ContributeSheet
        campaignId={campaignId}
        isOpen={showContributeSheet}
        onClose={() => setShowContributeSheet(false)}
      />
    </AppShell>
  );
}
