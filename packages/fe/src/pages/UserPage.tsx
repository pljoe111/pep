// State: Public user profile page at /users/:id
// Why here: Standalone page for viewing any user's public stats and campaigns
// Updates: Shows campaigns for all visitors, not just admins

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { usersApi, campaignsApi } from '../api/apiClient';
import { queryKeys } from '../api/queryKeys';
import { formatUSD } from '../lib/formatters';
import { useAuth } from '../hooks/useAuth';
import { campaignStatusVariant, campaignStatusLabel } from '../lib/badgeUtils';
import type { CampaignListDto } from 'api-client';

function UserCampaignsSection({ userId }: { userId: string }): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: campaignsResp, isLoading: campaignsLoading } = useQuery({
    queryKey: queryKeys.campaigns.byCreator(userId),
    queryFn: async () => {
      const res = await campaignsApi.getAllCampaigns(
        statusFilter || undefined,
        undefined,
        undefined,
        1,
        50
      );
      return res.data;
    },
  });

  // Filter campaigns by creator on the client side since the API doesn't support creator filter
  const allCampaigns: CampaignListDto[] = campaignsResp?.data ?? [];
  const campaigns = allCampaigns.filter((c) => c.creator?.id === userId);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-text">Campaigns</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
        >
          <option value="">All Status</option>
          <option value="created">Open</option>
          <option value="funded">Funded</option>
          <option value="samples_sent">Samples Sent</option>
          <option value="results_published">Results Published</option>
          <option value="resolved">Resolved</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {campaignsLoading && (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      )}
      {!campaignsLoading && campaigns.length === 0 && (
        <Card padding="md">
          <EmptyState
            heading="No campaigns found"
            subtext="This user hasn't created any campaigns yet."
          />
        </Card>
      )}
      {!campaignsLoading && campaigns.length > 0 && (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              to={`/campaigns/${campaign.id}`}
              className="block p-4 rounded-xl border border-border bg-surface hover:bg-surface-a transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-base text-text leading-tight mb-2 truncate">
                    {campaign.title}
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={campaignStatusVariant(campaign.status)}>
                      {campaignStatusLabel(campaign.status)}
                    </Badge>
                    {campaign.is_flagged_for_review && <Badge variant="amber">Flagged</Badge>}
                  </div>
                </div>
                <p className="text-lg font-bold text-primary shrink-0">
                  {formatUSD(campaign.current_funding_usd)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-400 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((campaign.current_funding_usd / campaign.funding_threshold_usd) * 100))}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-text-2 shrink-0 whitespace-nowrap">
                  {Math.round(
                    (campaign.current_funding_usd / campaign.funding_threshold_usd) * 100
                  )}
                  %
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-a border border-border">
      <div className="p-2 rounded-lg bg-primary-l text-primary">{icon}</div>
      <div>
        <p className="text-xl font-extrabold text-text">{value}</p>
        <p className="text-xs text-text-2">{label}</p>
      </div>
    </div>
  );
}

export function UserPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwnProfile = user?.id === id;

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

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <AppShell>
      <PageContainer className="py-0">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-primary to-primary-d rounded-b-3xl px-4 pt-6 pb-8 mb-6">
          <div className="flex items-center gap-4">
            <div className="ring-4 ring-white/20 rounded-full">
              <Avatar username={profile.username ?? undefined} size="lg" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white truncate">
                {profile.username ?? 'Anonymous'}
              </h1>
              <p className="text-sm text-primary-l mt-0.5">Member since {memberSince}</p>
              {isOwnProfile && (
                <Link to="/account" className="text-xs text-white underline mt-1 inline-block">
                  Edit profile
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="px-4 mb-6">
          <div className="grid grid-cols-1 gap-3">
            <StatCard
              label="Campaigns Created"
              value={String(profile.stats.campaigns_created)}
              icon={
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
                </svg>
              }
            />
            <StatCard
              label="Successful Campaigns"
              value={String(profile.stats.campaigns_successful)}
              icon={
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />
            <StatCard
              label="Total Contributed"
              value={formatUSD(profile.stats.total_contributed_usd)}
              icon={
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />
          </div>
        </div>

        {/* Campaigns section — visible to everyone */}
        <div className="px-4">{id && <UserCampaignsSection userId={id} />}</div>
      </PageContainer>
    </AppShell>
  );
}
