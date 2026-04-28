import type { CampaignDetailDto } from 'api-client';
import { useShipSamples } from '../../../api/hooks/useCampaigns';
import { useLabs } from '../../../api/hooks/useLabs';
import { Sheet } from '../../../components/ui/Sheet';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { useToast } from '../../../hooks/useToast';
import { AlertTriangle, MapPin, Beaker } from 'lucide-react';

interface ShipSamplesSheetProps {
  campaign: CampaignDetailDto;
  isOpen: boolean;
  onClose: () => void;
}

export const ShipSamplesSheet = ({ campaign, isOpen, onClose }: ShipSamplesSheetProps) => {
  const { mutate: shipSamples, isPending } = useShipSamples(campaign.id);
  const { data: response, isLoading: labsLoading } = useLabs(true, true);
  const toast = useToast();

  const labsData = response?.data || [];
  const uniqueLabIds = [...new Set(campaign.samples.map((s) => s.target_lab.id))];
  const campaignLabs = labsData.filter((l) => uniqueLabIds.includes(l.id));

  const handleSubmit = () => {
    shipSamples(undefined, {
      onSuccess: () => {
        toast.success('Shipment confirmed');
        onClose();
      },
      onError: (err: unknown) => {
        const msg =
          typeof err === 'object' && err !== null && 'response' in err
            ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ??
              'Failed to confirm shipment')
            : 'Failed to confirm shipment';
        toast.error(msg);
      },
    });
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Confirm Sample Shipment">
      <div className="space-y-8 pt-2">
        <p className="text-base text-text-2 leading-relaxed">
          Confirm that you have physically shipped all samples to the lab. This will notify all
          backers and start the results window.
        </p>

        <div className="space-y-4">
          <h3 className="text-xs font-medium text-text-3 uppercase tracking-wide">Lab Addresses</h3>

          {labsLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-24 bg-surface-a rounded-xl" />
            </div>
          ) : (
            <div className="space-y-3">
              {campaignLabs.map((lab) => {
                const labSamples = campaign.samples.filter((s) => s.target_lab.id === lab.id);
                return (
                  <Card key={lab.id} className="p-4 border-border/50">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <MapPin size={18} />
                        <span className="font-bold">{lab.name}</span>
                      </div>

                      <div className="text-sm text-text-2 bg-surface-a p-3 rounded-lg border border-border/30 whitespace-pre-wrap">
                        {lab.address || 'No address provided'}
                        {lab.country && `\n${lab.country}`}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {labSamples.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-1.5 px-2 py-1 bg-bg rounded-md border border-border/50 text-xs text-text-2"
                          >
                            <Beaker size={12} />
                            {s.sample_label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            Once confirmed, the 21-day results window begins. Ensure all tracking information is
            shared with backers via an update.
          </p>
        </div>

        <Button variant="primary" fullWidth size="lg" loading={isPending} onClick={handleSubmit}>
          I've shipped all samples — Confirm
        </Button>
      </div>
    </Sheet>
  );
};
