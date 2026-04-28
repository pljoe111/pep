import { Link } from 'react-router-dom';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import type { CampaignListDto } from 'api-client';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { CampaignStatusBadge } from '../../../components/campaigns/CampaignStatusBadge';
import { formatUSD } from '../../../lib/formatters';

interface CampaignListItemProps {
  campaign: CampaignListDto;
  onEdit: () => void;
  onDelete: () => void;
}

export function CampaignListItem({ campaign, onEdit, onDelete }: CampaignListItemProps) {
  const progress = Math.round(campaign.funding_progress_percent);

  const canEdit = campaign.status === 'created';
  const canDelete = campaign.status === 'created';

  return (
    <Card className="mb-3 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-wrap gap-2">
          <CampaignStatusBadge
            status={campaign.status}
            flaggedForReview={campaign.is_flagged_for_review}
          />
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xl font-bold text-text leading-tight">{campaign.title}</h3>
          {campaign.is_flagged_for_review && (
            <AlertTriangle className="text-warning shrink-0" size={18} />
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-end text-sm">
          <span className="font-bold text-primary">{progress}% funded</span>
          <span className="text-text-2">
            {formatUSD(campaign.current_funding_usd)} of {formatUSD(campaign.funding_threshold_usd)}
          </span>
        </div>
        <ProgressBar percent={progress} />
      </div>

      <div className="flex gap-2">
        <Link to={`/campaigns/${campaign.id}`} className="flex-1">
          <Button variant="ghost" size="sm" fullWidth className="min-h-[44px] py-2.5">
            View
          </Button>
        </Link>

        {canEdit && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onEdit}
            className="min-h-[44px] py-2.5"
            icon={<Pencil size={16} />}
          >
            Edit
          </Button>
        )}

        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="min-h-[44px] py-2.5 text-danger hover:text-danger hover:bg-danger/5"
            icon={<Trash2 size={16} />}
          >
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}
