import React from 'react';
import type { CampaignDetailDto } from 'api-client';
import { Card } from '../../../../components/ui/Card';
import { Badge } from '../../../../components/ui/Badge';
import { AdminStatusBadge } from '../shared/AdminStatusBadge';
import { AdminActionButton } from '../shared/AdminActionButton';

interface CampaignRowProps {
  campaign: CampaignDetailDto;
  onFlag: (id: string) => void;
  onUnflag: (id: string) => void;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  onRefund: (campaign: CampaignDetailDto) => void;
  onApproveResolution: (id: string) => void;
  isFlagPending: boolean;
  isHidePending: boolean;
}

export function CampaignRow({
  campaign,
  onFlag,
  onUnflag,
  onHide,
  onUnhide,
  onRefund,
  onApproveResolution,
  isFlagPending,
  isHidePending,
}: CampaignRowProps): React.ReactElement {
  return (
    <Card padding="md">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={`/campaigns/${campaign.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold text-text hover:text-primary underline"
          >
            {campaign.title}
          </a>
          {campaign.creator && (
            <p className="text-xs text-text-2 mt-0.5">
              by {campaign.creator.username ?? 'Anonymous'}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs font-mono bg-surface-a px-1.5 py-0.5 rounded text-text-3">
              {campaign.verification_code}
            </code>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AdminStatusBadge status={campaign.status} />
          {campaign.is_flagged_for_review && <Badge variant="amber">⚑ Flagged</Badge>}
          {campaign.is_hidden && <Badge variant="gray">Hidden</Badge>}
          <div className="flex flex-wrap gap-1.5">
            {campaign.is_flagged_for_review ? (
              <AdminActionButton
                variant="ghost"
                onClick={() => onUnflag(campaign.id)}
                loading={isFlagPending}
              >
                Unflag
              </AdminActionButton>
            ) : (
              <AdminActionButton
                variant="ghost"
                onClick={() => onFlag(campaign.id)}
                loading={isFlagPending}
              >
                Flag
              </AdminActionButton>
            )}
            {campaign.is_hidden ? (
              <AdminActionButton
                variant="ghost"
                onClick={() => onUnhide(campaign.id)}
                loading={isHidePending}
              >
                Unhide
              </AdminActionButton>
            ) : (
              <AdminActionButton
                variant="ghost"
                onClick={() => onHide(campaign.id)}
                loading={isHidePending}
              >
                Hide
              </AdminActionButton>
            )}
            {(campaign.status === 'created' || campaign.status === 'funded') && (
              <AdminActionButton variant="danger" onClick={() => onRefund(campaign)}>
                Refund
              </AdminActionButton>
            )}
            {campaign.status === 'results_published' && (
              <AdminActionButton variant="primary" onClick={() => onApproveResolution(campaign.id)}>
                Approve Resolution
              </AdminActionButton>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
