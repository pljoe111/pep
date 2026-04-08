import { useCampaignCoas } from '../../../api/hooks/useCampaigns';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import { COAStatusChip } from '../../../components/campaigns/COAStatusChip';
import { formatDate } from '../../../lib/formatters';
import { ExternalLink } from 'lucide-react';

interface ResultsTabProps {
  campaignId: string;
}

export const ResultsTab = ({ campaignId }: ResultsTabProps) => {
  const { data: coas, isLoading } = useCampaignCoas(campaignId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!coas || coas.length === 0) {
    return (
      <EmptyState
        heading="No results yet"
        subtext="Results will appear here once COAs are uploaded"
      />
    );
  }

  return (
    <div className="space-y-4">
      {coas.map((coa) => (
        <Card key={coa.id} className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium text-text truncate">{coa.file_name}</h4>
                <COAStatusChip status={coa.verification_status} />
              </div>
              <p className="text-xs text-text-3">Uploaded {formatDate(coa.uploaded_at)}</p>
            </div>

            <a
              href={coa.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 bg-transparent text-primary hover:bg-primary-l active:bg-primary-l focus-visible:ring-primary px-3 py-1.5 text-sm min-h-[36px]"
            >
              <ExternalLink className="w-4 h-4" />
              View PDF
            </a>
          </div>
        </Card>
      ))}
    </div>
  );
};
