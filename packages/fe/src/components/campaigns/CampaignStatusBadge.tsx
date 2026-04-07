import React from 'react';
import type { CampaignStatus } from 'api-client';
import { Badge } from '../ui/Badge';
import { campaignStatusVariant, campaignStatusLabel } from '../../lib/badgeUtils';

interface CampaignStatusBadgeProps {
  status: string; // CampaignStatus from api-client
  flaggedForReview?: boolean;
  className?: string;
}

export function CampaignStatusBadge({
  status,
  flaggedForReview,
  className = '',
}: CampaignStatusBadgeProps): React.ReactElement {
  const variant = campaignStatusVariant(status as CampaignStatus) || 'gray';
  const label = campaignStatusLabel(status as CampaignStatus) || 'Unknown';

  return (
    <span className={`flex gap-1 ${className}`}>
      <Badge variant={variant}>{label}</Badge>
      {flaggedForReview && <Badge variant="amber">Under Review</Badge>}
    </span>
  );
}
