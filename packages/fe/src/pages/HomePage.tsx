import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { CampaignCard, CampaignCardSkeleton } from '../components/campaigns/CampaignCard';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useCampaignFeed } from '../api/hooks/useCampaigns';
import { useDebounce } from '../hooks/useDebounce';
import type { CampaignFilters } from '../api/queryKeys';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'created', label: 'Open' },
  { value: 'funded', label: 'Funded' },
  { value: 'samples_sent', label: 'Samples Sent' },
  { value: 'results_published', label: 'Results Published' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'refunded', label: 'Refunded' },
];

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Newest' },
  { value: 'funding_progress_percent', label: 'Most Funded' },
  { value: 'deadline_fundraising', label: 'Deadline Soon' },
];

export function HomePage(): React.ReactElement {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('created_at');
  const loaderRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(searchInput, 300);

  const filters: CampaignFilters = {
    status: status || undefined,
    search: debouncedSearch || undefined,
    sort: sort || undefined,
  };

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, isError } =
    useCampaignFeed(filters);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loader);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const allCampaigns = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <AppShell>
      <PageContainer className="py-4">
        {/* Page header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-text">Campaigns</h1>
          <Button variant="ghost" size="sm" onClick={handleRefresh} aria-label="Refresh">
            <svg
              className="w-5 h-5"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </Button>
        </div>

        {/* Search */}
        <div className="mb-3">
          <Input
            placeholder="Search campaigns..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search campaigns"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
            className="flex-1"
          />
          <Select
            options={SORT_OPTIONS}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort by"
            className="flex-1"
          />
        </div>

        {/* Error state */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-center justify-between">
            <p className="text-sm text-danger font-medium">Failed to load campaigns</p>
            <Button variant="secondary" size="sm" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Campaign grid */}
        {!isLoading && allCampaigns.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && allCampaigns.length === 0 && !isError && (
          <EmptyState
            heading="No campaigns found"
            subtext={
              debouncedSearch || status
                ? 'Try adjusting your filters'
                : 'Be the first to create one!'
            }
            ctaLabel={!debouncedSearch && !status ? 'Create Campaign' : undefined}
            onCta={!debouncedSearch && !status ? () => void navigate('/create') : undefined}
          />
        )}

        {/* Infinite scroll sentinel */}
        <div ref={loaderRef} className="h-4 mt-4" aria-hidden="true" />

        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* End of list */}
        {!hasNextPage && allCampaigns.length > 0 && (
          <p className="text-center text-sm text-text-3 py-4">All campaigns loaded</p>
        )}
      </PageContainer>
    </AppShell>
  );
}
