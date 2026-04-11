import React from 'react';
import { Link } from 'react-router-dom';
import type { CampaignListDto } from 'api-client';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { CampaignStatusBadge } from './CampaignStatusBadge';
import { formatUSD, formatTimeRemaining } from '../../lib/formatters';

interface CampaignCardProps {
  campaign: CampaignListDto;
}

export function CampaignCard({ campaign }: CampaignCardProps): React.ReactElement {
  const currentFunding = Number(campaign.current_funding_usd);
  const threshold = Number(campaign.funding_threshold_usd);
  const percent = threshold > 0 ? (currentFunding / threshold) * 100 : 0;

  const vendors = campaign.vendor_names || [];
  const labs = campaign.lab_names || [];
  const samples = campaign.sample_labels || [];

  return (
    <div className="block no-underline">
      <Card className="flex flex-col gap-3 hover:border-primary transition-colors relative">
        <Link to={`/campaigns/${campaign.id}`} className="absolute inset-0 z-0" />
        <div className="flex justify-between items-start gap-2 relative z-10">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-text truncate">{campaign.title}</h3>
            <Link
              to={`/users/${campaign.creator.id}`}
              className="text-sm text-text-2 hover:text-primary transition-colors"
            >
              by {campaign.creator.username}
            </Link>
          </div>
          <CampaignStatusBadge
            status={campaign.status}
            flaggedForReview={campaign.is_flagged_for_review}
          />
        </div>

        <div className="space-y-1.5">
          <ProgressBar percent={percent} />
          <div className="flex justify-between items-baseline text-sm">
            <p className="text-text-2">
              <span className="font-bold text-text">{formatUSD(currentFunding)}</span> raised of{' '}
              {formatUSD(threshold)}
            </p>
            <p className="font-bold text-primary">{Math.round(percent)}%</p>
          </div>
        </div>

        {campaign.status === 'created' && campaign.time_remaining_seconds !== null && (
          <p className="text-xs text-text-2">
            Time remaining:{' '}
            <span className="text-text font-medium">
              {formatTimeRemaining(campaign.time_remaining_seconds)}
            </span>
          </p>
        )}

        <div className="flex flex-wrap gap-1 mt-1">
          {vendors.map((v) => (
            <span key={v} className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-text-3 rounded">
              {v}
            </span>
          ))}
          {labs.map((l) => (
            <span key={l} className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-text-3 rounded">
              {l}
            </span>
          ))}
        </div>

        {samples.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {samples.slice(0, 2).map((s) => (
              <span
                key={s}
                className="text-xs font-medium px-2 py-0.5 bg-primary-l text-primary rounded-full"
              >
                {s}
              </span>
            ))}
            {samples.length > 2 && (
              <span className="text-xs text-text-3 font-medium self-center">
                +{samples.length - 2} more
              </span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
