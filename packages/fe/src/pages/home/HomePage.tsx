import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageContainer } from '../../components/layout/PageContainer';
import { FeedFilters } from './components/FeedFilters';
import { CampaignFeed } from './components/CampaignFeed';

export default function HomePage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const sort = searchParams.get('sort') ?? 'newest';

  const updateParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        return next;
      },
      { replace: true }
    );
  };

  return (
    <AppShell>
      <PageContainer>
        <FeedFilters
          status={status}
          search={search}
          sort={sort}
          onStatusChange={(v) => updateParam('status', v)}
          onSearchChange={(v) => updateParam('search', v)}
          onSortChange={(v) => updateParam('sort', v)}
        />
        <CampaignFeed status={status} search={search} sort={sort} />
      </PageContainer>
    </AppShell>
  );
}
