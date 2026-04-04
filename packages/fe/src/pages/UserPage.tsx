// State: Public user profile page at /users/:id
// Why here: Standalone page for viewing any user's public stats
// Updates: Fetches PublicUserProfileDto via GET /users/:id/profile

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { usersApi } from '../api/apiClient';
import { queryKeys } from '../api/queryKeys';
import { formatUSD } from '../lib/formatters';

export function UserPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.users.profile(id ?? ''),
    queryFn: async () => {
      const res = await usersApi.getPublicProfile(id ?? '');
      return res.data;
    },
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <AppShell>
        <PageContainer className="py-8 flex items-center justify-center">
          <Spinner size="lg" />
        </PageContainer>
      </AppShell>
    );
  }

  if (isError || !profile) {
    return (
      <AppShell>
        <PageContainer className="py-8">
          <EmptyState
            heading="User not found"
            subtext="This profile doesn't exist or has been removed."
            ctaLabel="Go Home"
            onCta={() => void navigate('/')}
          />
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer className="py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar username={profile.username ?? undefined} size="lg" />
          <div>
            <h1 className="text-2xl font-bold text-text">{profile.username ?? 'Anonymous'}</h1>
            <p className="text-sm text-text-2">Member since {profile.created_at.slice(0, 10)}</p>
          </div>
        </div>

        {/* Stats */}
        <Card padding="md" className="mb-4">
          <h2 className="text-lg font-semibold text-text mb-4">Activity</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-extrabold text-primary">
                {profile.stats.campaigns_created}
              </p>
              <p className="text-xs text-text-2 mt-1">Campaigns Created</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-success">
                {profile.stats.campaigns_successful}
              </p>
              <p className="text-xs text-text-2 mt-1">Successful</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-text">
                {formatUSD(profile.stats.total_contributed_usd)}
              </p>
              <p className="text-xs text-text-2 mt-1">Total Contributed</p>
            </div>
          </div>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
