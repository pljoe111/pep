import type { CampaignDetailDto } from 'api-client';
import { useLockCampaign } from '../../../api/hooks/useCampaigns';
import { Sheet } from '../../../components/ui/Sheet';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';
import { formatUSD } from '../../../lib/formatters';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface LockCampaignSheetProps {
  campaign: CampaignDetailDto;
  isOpen: boolean;
  onClose: () => void;
}

export const LockCampaignSheet = ({ campaign, isOpen, onClose }: LockCampaignSheetProps) => {
  const { mutate: lockCampaign, isPending } = useLockCampaign(campaign.id);
  const toast = useToast();

  const fundingMet = campaign.current_funding_usd >= campaign.funding_threshold_usd;
  const notFlagged = !campaign.is_flagged_for_review;
  const canLock = fundingMet && notFlagged;

  const handleSubmit = () => {
    if (!canLock) return;
    lockCampaign(undefined, {
      onSuccess: () => {
        toast.success('Campaign locked');
        onClose();
      },
      onError: (error: any) => {
        toast.error(error?.response?.data?.message || 'Failed to lock campaign');
      },
    });
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Lock Campaign">
      <div className="space-y-8 pt-2">
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-text-3 uppercase tracking-wide">
            Requirements checklist
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {fundingMet ? (
                <CheckCircle size={20} className="text-success shrink-0" />
              ) : (
                <XCircle size={20} className="text-danger shrink-0" />
              )}
              <div className="flex flex-col">
                <span
                  className={`text-sm font-semibold ${fundingMet ? 'text-text' : 'text-danger'}`}
                >
                  Funding threshold met
                </span>
                <span className="text-xs text-text-2">
                  {formatUSD(campaign.current_funding_usd)} raised of{' '}
                  {formatUSD(campaign.funding_threshold_usd)} required
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {notFlagged ? (
                <CheckCircle size={20} className="text-success shrink-0" />
              ) : (
                <XCircle size={20} className="text-danger shrink-0" />
              )}
              <div className="flex flex-col">
                <span
                  className={`text-sm font-semibold ${notFlagged ? 'text-text' : 'text-danger'}`}
                >
                  Campaign not under review
                </span>
                {!notFlagged && (
                  <span className="text-xs text-danger">
                    Contact support to clear the review flag before locking.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            <span className="font-bold">Warning:</span> Locking closes contributions. This cannot be
            undone.
          </p>
        </div>

        <Button
          variant="primary"
          fullWidth
          size="lg"
          disabled={!canLock}
          loading={isPending}
          onClick={handleSubmit}
        >
          {canLock ? 'Lock Campaign' : 'Requirements not met'}
        </Button>
      </div>
    </Sheet>
  );
};
