import { Link } from 'react-router-dom';
import { useMyContributions } from '../../../api/hooks/useWallet';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { CampaignStatusBadge } from '../../../components/campaigns/CampaignStatusBadge';
import { formatUSD, formatDate } from '../../../lib/formatters';
import type { ContributionDto } from 'api-client';

export function ContributionList() {
  const { data, isLoading } = useMyContributions() as {
    data: { data: ContributionDto[] } | undefined;
    isLoading: boolean;
  };
  const contributions: ContributionDto[] = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (contributions.length === 0) {
    return (
      <EmptyState
        heading="No contributions yet"
        subtext="Explore campaigns and back the ones you want to see tested."
        ctaLabel="Explore Campaigns"
        onCta={() => (window.location.href = '/')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {contributions.map((c) => (
        <div key={c.id} className="p-4 bg-surface border border-border rounded-xl space-y-3">
          <div className="flex justify-between items-start">
            <Link
              to={`/campaigns/${c.campaign_id}`}
              className="text-sm font-bold text-text hover:text-primary transition-colors line-clamp-1 flex-1 mr-4"
            >
              {c.campaign_title}
            </Link>
            <span className="text-xs text-text-3 whitespace-nowrap">
              {formatDate(c.contributed_at)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            {/* Note: campaign_status is not in ContributionDto, defaulting to created */}
            <CampaignStatusBadge status="created" />
            <div className="text-sm">
              <span className="text-text-2">Contributed: </span>
              <span
                className={`font-bold ${
                  c.status === 'refunded' ? 'line-through text-text-3' : 'text-text'
                }`}
              >
                {formatUSD(c.amount_usd)}
              </span>
              {c.status === 'refunded' && (
                <span className="text-xs text-text-3 ml-1">(refunded)</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
