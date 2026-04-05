import React from 'react';
import { Link } from 'react-router-dom';
import type { CampaignListDto } from 'api-client';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';
import { campaignStatusVariant, campaignStatusLabel } from '../../lib/badgeUtils';
import { formatUSD, formatPercent, formatTimeRemaining } from '../../lib/formatters';

interface CampaignCardProps {
  campaign: CampaignListDto;
}

export function CampaignCard({ campaign }: CampaignCardProps): React.ReactElement {
  const progress = campaign.funding_progress_percent ?? 0;
  const timeLeft = campaign.time_remaining_seconds ?? 0;
  const sampleLabels = campaign.sample_labels ?? [];
  const vendorNames = campaign.vendor_names ?? [];
  const labNames = campaign.lab_names ?? [];

  return (
    <Link to={`/campaigns/${campaign.id}`} className="block group" aria-label={campaign.title}>
      <Card className="h-full group-hover:shadow-md transition-shadow duration-150" padding="md">
        {/* Status badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant={campaignStatusVariant(campaign.status)}>
            {campaignStatusLabel(campaign.status)}
          </Badge>
          {campaign.is_flagged_for_review && (
            <span className="text-xs text-warning font-medium flex items-center gap-1 shrink-0">
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
              Review
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold text-lg text-text leading-snug mb-1 line-clamp-2">
          {campaign.title}
        </h3>

        {/* Creator */}
        <p className="text-sm text-text-2 mb-3">
          by{' '}
          <span className="font-semibold text-text">
            {campaign.creator?.username ?? 'Anonymous'}
          </span>
        </p>

        {/* Vendors & Labs */}
        {(vendorNames.length > 0 || labNames.length > 0) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
            {vendorNames.length > 0 && (
              <span className="text-xs text-text-2">
                <span className="font-medium text-text">Vendor:</span>{' '}
                <span className="text-primary">{vendorNames.join(', ')}</span>
              </span>
            )}
            {labNames.length > 0 && (
              <span className="text-xs text-text-2">
                <span className="font-medium text-text">Lab:</span>{' '}
                <span className="text-text">{labNames.join(', ')}</span>
              </span>
            )}
          </div>
        )}

        {/* Sample labels */}
        {sampleLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {sampleLabels.slice(0, 2).map((label) => (
              <span
                key={label}
                className="text-xs bg-surface-a border border-border px-2.5 py-1 rounded-full text-text-2 leading-tight"
              >
                {label}
              </span>
            ))}
            {sampleLabels.length > 2 && (
              <span className="text-xs text-text-3 self-center">
                +{sampleLabels.length - 2} more
              </span>
            )}
          </div>
        )}

        {/* Progress bar */}
        <ProgressBar
          percent={progress}
          color={progress >= 100 ? 'success' : 'primary'}
          size="sm"
          className="mb-2"
        />

        {/* Funding stats — 2 rows */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xl font-extrabold text-primary">{formatPercent(progress)}</span>
          <span className="text-sm font-semibold text-text">
            {formatUSD(campaign.current_funding_usd ?? 0)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-text-2 mb-3">
          <span>funded</span>
          <span>of {formatUSD(campaign.amount_requested_usd)} goal</span>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-border">
          <span className="text-xs text-text-3">
            {timeLeft > 0 ? `${formatTimeRemaining(timeLeft)} left` : 'Fundraising ended'}
          </span>
        </div>
      </Card>
    </Link>
  );
}

/** Skeleton loading card */
export function CampaignCardSkeleton(): React.ReactElement {
  return (
    <div className="bg-surface rounded-2xl border border-border p-4 animate-pulse">
      <div className="h-5 bg-stone-200 rounded-full w-20 mb-3" />
      <div className="h-6 bg-stone-200 rounded w-5/6 mb-1" />
      <div className="h-6 bg-stone-200 rounded w-3/4 mb-3" />
      <div className="h-4 bg-stone-200 rounded w-1/3 mb-4" />
      <div className="flex gap-1.5 mb-4">
        <div className="h-6 bg-stone-200 rounded-full w-24" />
        <div className="h-6 bg-stone-200 rounded-full w-20" />
      </div>
      <div className="h-2 bg-stone-200 rounded-full mb-3" />
      <div className="flex justify-between mb-1">
        <div className="h-7 bg-stone-200 rounded w-14" />
        <div className="h-5 bg-stone-200 rounded w-20" />
      </div>
      <div className="flex justify-between mb-3">
        <div className="h-3 bg-stone-200 rounded w-10" />
        <div className="h-3 bg-stone-200 rounded w-24" />
      </div>
      <div className="pt-3 border-t border-border">
        <div className="h-3 bg-stone-200 rounded w-20" />
      </div>
    </div>
  );
}
