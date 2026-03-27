import React from 'react';
import { Link } from 'react-router-dom';
import type { CampaignListDto } from 'api-client';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { campaignStatusVariant, campaignStatusLabel } from '../../lib/badgeUtils';
import { ProgressBar } from '../ui/ProgressBar';
import { formatUSD, formatPercent, formatTimeRemaining } from '../../lib/formatters';

interface CampaignCardProps {
  campaign: CampaignListDto;
}

export function CampaignCard({ campaign }: CampaignCardProps): React.ReactElement {
  const progress = campaign.funding_progress_percent ?? 0;
  const timeLeft = campaign.time_remaining_seconds ?? 0;
  const sampleLabels = campaign.sample_labels ?? [];

  return (
    <Link to={`/campaigns/${campaign.id}`} className="block group" aria-label={campaign.title}>
      <Card className="h-full group-hover:shadow-md transition-shadow duration-150" padding="md">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-bold text-base text-text leading-snug line-clamp-2 flex-1">
            {campaign.title}
          </h3>
          <Badge variant={campaignStatusVariant(campaign.status)}>
            {campaignStatusLabel(campaign.status)}
          </Badge>
        </div>

        {/* Creator */}
        <p className="text-sm text-text-2 mb-3">
          by{' '}
          <span className="font-medium text-text">{campaign.creator?.username ?? 'Anonymous'}</span>
        </p>

        {/* Sample labels */}
        {sampleLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {sampleLabels.slice(0, 3).map((label) => (
              <span
                key={label}
                className="text-xs bg-surface-a border border-border px-2 py-0.5 rounded-full text-text-2"
              >
                {label}
              </span>
            ))}
            {sampleLabels.length > 3 && (
              <span className="text-xs text-text-3">+{sampleLabels.length - 3} more</span>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="mb-2">
          <ProgressBar
            percent={progress}
            color={progress >= 100 ? 'success' : 'primary'}
            size="sm"
          />
        </div>

        {/* Funding info row */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-primary">{formatPercent(progress)}</span>
          <span className="text-text-2">{formatUSD(campaign.current_funding_usd ?? 0)} raised</span>
          <span className="text-text-2">of {formatUSD(campaign.amount_requested_usd)}</span>
        </div>

        {/* Footer: time remaining + flagged */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-xs text-text-3">
            {timeLeft > 0 ? `${formatTimeRemaining(timeLeft)} left` : 'No deadline'}
          </span>
          {campaign.is_flagged_for_review && (
            <span className="text-xs text-warning font-medium flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
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
              Under Review
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

/** Skeleton loading card matching CampaignCard shape */
export function CampaignCardSkeleton(): React.ReactElement {
  return (
    <div className="bg-surface rounded-2xl border border-border p-4 animate-pulse">
      <div className="flex justify-between gap-2 mb-3">
        <div className="h-5 bg-stone-200 rounded w-3/4" />
        <div className="h-5 bg-stone-200 rounded w-16" />
      </div>
      <div className="h-4 bg-stone-200 rounded w-1/3 mb-3" />
      <div className="flex gap-1 mb-3">
        <div className="h-5 bg-stone-200 rounded-full w-16" />
        <div className="h-5 bg-stone-200 rounded-full w-20" />
      </div>
      <div className="h-2 bg-stone-200 rounded-full mb-2" />
      <div className="flex justify-between">
        <div className="h-4 bg-stone-200 rounded w-12" />
        <div className="h-4 bg-stone-200 rounded w-24" />
        <div className="h-4 bg-stone-200 rounded w-20" />
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        <div className="h-4 bg-stone-200 rounded w-20" />
      </div>
    </div>
  );
}
