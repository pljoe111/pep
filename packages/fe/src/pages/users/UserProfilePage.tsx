import { useParams } from 'react-router-dom';
import { Calendar, Award, TrendingUp } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { PageContainer } from '../../components/layout/PageContainer';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { CampaignCard } from '../../components/campaigns/CampaignCard';
import { usePublicProfile } from '../../api/hooks/useUsers';
import { useCreatorCampaigns } from '../../api/hooks/useCampaigns';
import { formatDate, formatUSD } from '../../lib/formatters';

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: profile, isLoading: profileLoading, isError: profileError } = usePublicProfile(id!);
  const { data: campaigns, isLoading: campaignsLoading } = useCreatorCampaigns(id!);

  if (profileLoading) {
    return (
      <AppShell>
        <PageContainer className="flex items-center justify-center min-h-[60vh]">
          <Spinner size="lg" />
        </PageContainer>
      </AppShell>
    );
  }

  if (profileError || !profile) {
    return (
      <AppShell>
        <PageContainer>
          <EmptyState
            heading="User not found"
            subtext="The user you are looking for does not exist or has been removed."
            ctaLabel="Go Home"
            onCta={() => (window.location.href = '/')}
          />
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer>
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-8 pt-4">
          <Avatar
            username={profile.username ?? 'User'}
            size="lg"
            className="w-24 h-24 text-3xl mb-4 shadow-sm"
          />
          <h1 className="text-3xl font-bold text-text mb-1">
            {profile.username ?? 'Anonymous User'}
          </h1>
          <div className="flex items-center text-text-2 text-sm">
            <Calendar size={14} className="mr-1.5" />
            <span>Joined {formatDate(profile.created_at)}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          <Card className="p-3 flex flex-col items-center justify-center text-center bg-surface border-border/50">
            <TrendingUp size={20} className="text-primary mb-1.5" />
            <span className="text-lg font-bold text-text">
              {formatUSD(profile.stats.total_contributed_usd)}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-text-2">
              Contributed
            </span>
          </Card>
          <Card className="p-3 flex flex-col items-center justify-center text-center bg-surface border-border/50">
            <Award size={20} className="text-amber-500 mb-1.5" />
            <span className="text-lg font-bold text-text">{profile.stats.campaigns_created}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-text-2">
              Created
            </span>
          </Card>
          <Card className="p-3 flex flex-col items-center justify-center text-center bg-surface border-border/50">
            <Award size={20} className="text-emerald-500 mb-1.5" />
            <span className="text-lg font-bold text-text">
              {profile.stats.campaigns_successful}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-text-2">
              Successful
            </span>
          </Card>
        </div>

        {/* Campaigns Section */}
        <div className="space-y-4 mb-12">
          <h2 className="text-xl font-bold text-text px-1">Campaigns</h2>

          {campaignsLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse bg-surface rounded-xl h-48 w-full" />
              ))}
            </div>
          ) : campaigns?.data && campaigns.data.length > 0 ? (
            <div className="flex flex-col gap-4">
              {campaigns.data.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center border-dashed border-2 bg-transparent">
              <p className="text-text-2">No public campaigns found for this user.</p>
            </Card>
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}
