import React from 'react';
import type { CampaignDetailDto } from 'api-client';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { formatUSD, formatTimeRemaining } from '../../lib/formatters';

interface FundingCardProps {
  campaign: CampaignDetailDto;
  myContribution?: number | null; // shown as teal pill if > 0
}

export function FundingCard({ campaign, myContribution }: FundingCardProps): React.ReactElement {
  const currentFunding = Number(campaign.current_funding_usd);
  const threshold = Number(campaign.funding_threshold_usd);
  const totalRequested = Number(campaign.amount_requested_usd);
  const percent = threshold > 0 ? (currentFunding / threshold) * 100 : 0;
  const platformFee = campaign.platform_fee_percent ?? 0;

  return (
    <Card className="flex flex-col gap-4">
      <div className="space-y-2">
        <ProgressBar percent={percent} />
        <div className="flex justify-between items-baseline">
          <p className="text-sm font-medium text-text">
            <span className="font-bold">{formatUSD(currentFunding)}</span> raised of{' '}
            {formatUSD(threshold)} goal
          </p>
          <p className="text-sm font-bold text-primary">{Math.round(percent)}%</p>
        </div>
        {totalRequested !== threshold && (
          <p className="text-xs text-text-2">Total requested: {formatUSD(totalRequested)}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {campaign.status === 'created' && campaign.deadlines?.fundraising && (
          <p className="text-sm text-text-2">
            Time remaining:{' '}
            <span className="text-text font-medium">
              {formatTimeRemaining(
                Math.max(
                  0,
                  Math.floor(
                    (new Date(campaign.deadlines.fundraising).getTime() - Date.now()) / 1000
                  )
                )
              )}
            </span>
          </p>
        )}
        <p className="text-text-3 text-xs">Platform fee: {platformFee}% on resolution</p>
      </div>

      {myContribution && myContribution > 0 && (
        <div className="pt-2 border-t border-border">
          <span className="inline-flex items-center bg-primary-l text-primary text-xs font-medium rounded-full px-3 py-0.5">
            You contributed {formatUSD(myContribution)}
          </span>
        </div>
      )}
    </Card>
  );
}
