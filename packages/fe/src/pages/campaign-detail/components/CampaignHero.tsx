import { Link } from 'react-router-dom';
import type { CampaignDetailDto } from 'api-client';
import { CampaignStatusBadge } from '../../../components/campaigns/CampaignStatusBadge';
import { AlertTriangle, AlertCircle } from 'lucide-react';

interface CampaignHeroProps {
  campaign: CampaignDetailDto;
}

export const CampaignHero = ({ campaign }: CampaignHeroProps) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <CampaignStatusBadge
          status={campaign.status}
          flaggedForReview={campaign.is_flagged_for_review}
        />
      </div>

      <h1 className="text-3xl font-bold text-text leading-tight">{campaign.title}</h1>

      <div className="text-sm text-text-2">
        Created by{' '}
        <Link
          to={`/users/${campaign.creator.id}`}
          className="font-medium text-primary hover:underline"
        >
          @{campaign.creator.username || 'anonymous'}
        </Link>
        {' · '}
        <span>{campaign.creator.successful_campaigns} resolved campaigns</span>
      </div>

      {campaign.is_flagged_for_review && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3.5 text-sm flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold mb-0.5">Under Review</p>
            <p className="opacity-90">
              This campaign is under admin review. Contributions are paused.
            </p>
          </div>
        </div>
      )}

      {campaign.status === 'refunded' && campaign.refund_reason && (
        <div className="bg-red-50 border border-red-200 text-danger rounded-xl p-3.5 text-sm flex gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold mb-0.5">Campaign Refunded</p>
            <p className="opacity-90">Reason: {campaign.refund_reason}</p>
          </div>
        </div>
      )}
    </div>
  );
};
