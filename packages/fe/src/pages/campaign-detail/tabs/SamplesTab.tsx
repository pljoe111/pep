import type { CampaignDetailDto } from 'api-client';
import { SampleCard } from '../components/SampleCard';

interface SamplesTabProps {
  campaign: CampaignDetailDto;
  isCreator: boolean;
  onReplaceCoaClick: (sampleId: string) => void;
}

export const SamplesTab = ({ campaign, isCreator, onReplaceCoaClick }: SamplesTabProps) => {
  const approvedCount = campaign.samples.filter(
    (s) => s.coa?.verification_status === 'manually_approved'
  ).length;

  const totalSamples = campaign.samples.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-text-2">
          {totalSamples} {totalSamples === 1 ? 'sample' : 'samples'}
          {' · '}
          COAs: {approvedCount}/{totalSamples} approved
        </span>
      </div>

      <div className="space-y-4">
        {campaign.samples
          .sort((a, b) => a.order_index - b.order_index)
          .map((sample) => (
            <SampleCard
              key={sample.id}
              sample={sample}
              isCreator={isCreator}
              onReplaceCoaClick={onReplaceCoaClick}
            />
          ))}
      </div>
    </div>
  );
};
