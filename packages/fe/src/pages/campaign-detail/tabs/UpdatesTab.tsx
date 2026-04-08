import { useCampaignUpdates } from '../../../api/hooks/useCampaigns';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import { formatDate } from '../../../lib/formatters';

interface UpdatesTabProps {
  campaignId: string;
}

export const UpdatesTab = ({ campaignId }: UpdatesTabProps) => {
  const { data: response, isLoading } = useCampaignUpdates(campaignId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const updates = response?.data || [];

  if (updates.length === 0) {
    return (
      <EmptyState heading="No updates yet" subtext="Updates from the creator will appear here" />
    );
  }

  // Sort updates in reverse-chronological order
  const sortedUpdates = [...updates].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="divide-y divide-border">
      {sortedUpdates.map((update) => (
        <div key={update.id} className="py-6 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text">Creator</span>
            <span className="text-xs text-text-3">{formatDate(update.created_at)}</span>
          </div>
          <div className="text-sm text-text whitespace-pre-wrap leading-relaxed">
            {update.content}
          </div>
        </div>
      ))}
    </div>
  );
};
