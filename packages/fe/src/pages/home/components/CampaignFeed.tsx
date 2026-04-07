import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaignsFeed } from '../../../api/hooks/useCampaigns';
import { CampaignCard } from '../../../components/campaigns/CampaignCard';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';

interface CampaignFeedProps {
  status: string;
  search: string;
  sort: string;
}

export function CampaignFeed({ status, search, sort }: CampaignFeedProps): React.ReactElement {
  const navigate = useNavigate();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useCampaignsFeed({ status, search, sort });

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-surface rounded-xl h-48 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        heading="Failed to load campaigns"
        subtext="There was an error fetching the campaign feed."
        ctaLabel="Try again"
        onCta={() => {
          void refetch();
        }}
      />
    );
  }

  const campaigns = data?.pages.flatMap((page) => page.data) ?? [];

  if (campaigns.length === 0) {
    // No filter match vs completely empty
    const isFiltered = status || search;
    if (isFiltered) {
      return (
        <EmptyState
          heading="No campaigns match your filters"
          subtext="Try adjusting your search or filters to find what you're looking for."
          ctaLabel="Clear filters"
          onCta={() => {
            window.location.search = '';
          }}
        />
      );
    }

    return (
      <EmptyState
        heading="No campaigns yet"
        subtext="Be the first to start a research campaign for a new peptide."
        ctaLabel="Create the first one"
        onCta={() => {
          void navigate('/create');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-10 flex items-center justify-center">
        {isFetchingNextPage && <Spinner size="sm" />}
      </div>
    </div>
  );
}
