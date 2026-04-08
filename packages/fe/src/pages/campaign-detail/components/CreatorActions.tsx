import type { CampaignDetailDto } from 'api-client';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { formatUSD, formatDate } from '../../../lib/formatters';
import {
  Lock,
  Package,
  Upload,
  MessageSquare,
  AlertCircle,
  Beaker,
  ShoppingCart,
  Calendar,
} from 'lucide-react';

interface CreatorActionsProps {
  campaign: CampaignDetailDto;
  onOpenSheet: (sheet: 'lock' | 'ship' | 'upload-coa' | 'post-update', sampleId?: string) => void;
}

export const CreatorActions = ({ campaign, onOpenSheet }: CreatorActionsProps) => {
  const { status, samples } = campaign;

  const showLock = status === 'created';
  const showShip = status === 'funded';
  const showUploadCoa = status === 'funded' || status === 'samples_sent';
  const showPostUpdate =
    status === 'samples_sent' || status === 'results_published' || status === 'resolved';
  const showPayoutPreview = status === 'results_published';

  const rejectedCoas = samples.filter((s) => s.coa?.verification_status === 'rejected');

  if (
    !showLock &&
    !showShip &&
    !showUploadCoa &&
    !showPostUpdate &&
    !showPayoutPreview &&
    rejectedCoas.length === 0
  ) {
    return null;
  }

  const escrowBalance = campaign.current_funding_usd;
  const feePercent = campaign.platform_fee_percent || 5;
  const feeAmount = (escrowBalance * feePercent) / 100;
  const netAmount = escrowBalance - feeAmount;

  return (
    <div className="space-y-4">
      {rejectedCoas.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-danger uppercase tracking-wide px-1">
            Action Required: Rejected COAs
          </h3>
          {rejectedCoas.map((sample) => (
            <Card key={sample.id} className="p-4 border-danger/30 bg-red-50/30">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="mb-3">
                    <p className="text-sm font-bold text-text mb-1">
                      {sample.sample_label} — {sample.coa?.file_name}
                    </p>
                    <div className="bg-white/50 rounded-lg p-2.5 border border-danger/10 space-y-2">
                      <p className="text-sm text-danger font-medium">
                        Reason: {sample.coa?.verification_notes || 'No reason provided'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-text-2">
                      <Beaker className="w-3.5 h-3.5 text-text-3" />
                      <span className="font-medium">Peptide:</span>
                      <span className="text-text">{sample.peptide?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-2">
                      <ShoppingCart className="w-3.5 h-3.5 text-text-3" />
                      <span className="font-medium">Vendor:</span>
                      <span className="text-text">{sample.vendor_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-2">
                      <Calendar className="w-3.5 h-3.5 text-text-3" />
                      <span className="font-medium">Purchased:</span>
                      <span className="text-text">{formatDate(sample.purchase_date)}</span>
                    </div>
                  </div>

                  <Button
                    variant="danger"
                    size="sm"
                    fullWidth
                    onClick={() => onOpenSheet('upload-coa', sample.id)}
                  >
                    <Upload className="w-4 h-4" />
                    Replace COA
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 space-y-4">
        <h3 className="text-xs font-medium text-text-3 uppercase tracking-wide">Creator Actions</h3>

        <div className="flex flex-wrap gap-3">
          {showLock && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => onOpenSheet('lock')}
              className="flex-1 min-w-[140px]"
            >
              <Lock className="w-4 h-4" />
              Lock Campaign
            </Button>
          )}

          {showShip && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => onOpenSheet('ship')}
              className="flex-1 min-w-[140px]"
            >
              <Package className="w-4 h-4" />
              Ship Samples
            </Button>
          )}

          {showUploadCoa && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => onOpenSheet('upload-coa')}
              className="flex-1 min-w-[140px]"
            >
              <Upload className="w-4 h-4" />
              Upload COA
            </Button>
          )}

          {showPostUpdate && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => onOpenSheet('post-update')}
              className="flex-1 min-w-[140px]"
            >
              <MessageSquare className="w-4 h-4" />
              Post Update
            </Button>
          )}
        </div>

        {showPayoutPreview && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-text-2">
                <span>Escrow balance:</span>
                <span>{formatUSD(escrowBalance)}</span>
              </div>
              <div className="flex justify-between text-text-2">
                <span>Platform fee ({feePercent}%):</span>
                <span>− {formatUSD(feeAmount)}</span>
              </div>
              <div className="pt-1.5 border-t border-border flex justify-between font-bold text-text">
                <span>You receive:</span>
                <span>{formatUSD(netAmount)}</span>
              </div>
            </div>
            <p className="text-xs text-text-3 italic">
              "An admin is reviewing your resolution. You'll be notified when funds are credited."
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
