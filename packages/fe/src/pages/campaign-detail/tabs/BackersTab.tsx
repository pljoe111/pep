import { Link } from 'react-router-dom';
import { useCampaignContributions } from '../../../api/hooks/useCampaigns';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import { formatUSD, formatDate } from '../../../lib/formatters';

interface BackersTabProps {
  campaignId: string;
  currentUserId?: string;
}

export const BackersTab = ({ campaignId, currentUserId }: BackersTabProps) => {
  const { data: response, isLoading } = useCampaignContributions(campaignId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const contributions = response?.data || [];

  if (contributions.length === 0) {
    return (
      <EmptyState heading="No backers yet" subtext="Be the first to contribute to this campaign" />
    );
  }

  return (
    <div className="divide-y divide-border">
      {contributions.map((contribution) => {
        const isMe = currentUserId === contribution.contributor.id;
        const isRefunded = contribution.status === 'refunded';

        return (
          <div
            key={contribution.id}
            className={[
              'flex items-center justify-between py-4 px-2 transition-colors',
              isMe ? 'border-l-2 border-primary bg-primary-l/30 pl-3' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="flex flex-col">
              <Link
                to={`/users/${contribution.contributor.id}`}
                className="text-sm font-medium text-text hover:text-primary transition-colors"
              >
                @{contribution.contributor.username || 'anonymous'}
              </Link>
              <span className="text-xs text-text-3">{formatDate(contribution.contributed_at)}</span>
            </div>

            <div className="text-right">
              <span
                className={[
                  'text-sm font-medium',
                  isRefunded ? 'text-text-3 line-through' : 'text-text',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {formatUSD(contribution.amount_usd)}
              </span>
              {isRefunded && <span className="ml-1 text-xs text-text-3">(refunded)</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
