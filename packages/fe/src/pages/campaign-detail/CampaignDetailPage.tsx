import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaignDetail } from '../../api/hooks/useCampaigns';
import { useAuth } from '../../hooks/useAuth';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { CampaignHero } from './components/CampaignHero';
import { CreatorActions } from './components/CreatorActions';
import { FundingCard } from '../../components/campaigns/FundingCard';
import { OverviewTab } from './tabs/OverviewTab';
import { SamplesTab } from './tabs/SamplesTab';
import { UpdatesTab } from './tabs/UpdatesTab';
import { BackersTab } from './tabs/BackersTab';
import { ArrowLeft } from 'lucide-react';

// Action Sheets
import { ContributeSheet } from './sheets/ContributeSheet';
import { LockCampaignSheet } from './sheets/LockCampaignSheet';
import { ShipSamplesSheet } from './sheets/ShipSamplesSheet';
import { UploadCOASheet } from './sheets/UploadCOASheet';
import { PostUpdateSheet } from './sheets/PostUpdateSheet';

type SheetType = 'contribute' | 'lock' | 'ship' | 'upload-coa' | 'post-update' | null;

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [openSheet, setOpenSheet] = useState<SheetType>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | undefined>();

  const { data: campaign, isLoading, isError } = useCampaignDetail(id || '');

  const isAdmin = user?.claims.includes('admin');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !campaign) {
    return (
      <div className="p-4">
        <EmptyState
          heading="Campaign not found"
          subtext="The campaign you're looking for doesn't exist or has been removed."
          ctaLabel="Back to Home"
          onCta={() => {
            void navigate('/');
          }}
        />
      </div>
    );
  }

  // Guard for hidden campaigns
  if (campaign.is_hidden && !isAdmin && campaign.creator.id !== user?.id) {
    return (
      <div className="p-4">
        <EmptyState
          heading="Campaign not found"
          subtext="The campaign you're looking for doesn't exist or has been removed."
          ctaLabel="Back to Home"
          onCta={() => {
            void navigate('/');
          }}
        />
      </div>
    );
  }

  const isCreator = user?.id === campaign.creator.id;
  const canContribute =
    user && !isCreator && campaign.status === 'created' && !campaign.is_flagged_for_review;

  const handleOpenSheet = (sheet: Exclude<SheetType, null>, sampleId?: string) => {
    setSelectedSampleId(sampleId);
    setOpenSheet(sheet);
  };

  const TABS = [
    {
      id: 'overview',
      label: 'Overview',
      content: <OverviewTab campaign={campaign} />,
    },
    {
      id: 'samples',
      label: 'Samples',
      content: (
        <SamplesTab
          campaign={campaign}
          isCreator={isCreator}
          onReplaceCoaClick={(sampleId) => handleOpenSheet('upload-coa', sampleId)}
        />
      ),
    },
    {
      id: 'updates',
      label: 'Updates',
      content: <UpdatesTab campaignId={campaign.id} />,
    },
    {
      id: 'backers',
      label: 'Backers',
      content: <BackersTab campaignId={campaign.id} currentUserId={user?.id} />,
    },
  ];

  return (
    <div className="pb-32">
      {/* Top Navigation */}
      <div className="sticky top-0 z-20 bg-bg/80 backdrop-blur-md px-4 py-3 flex items-center gap-4 border-b border-border">
        <button
          onClick={() => {
            void navigate(-1);
          }}
          className="p-2 -ml-2 hover:bg-surface-a rounded-full transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-text truncate">Campaign Details</h2>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Hero Section */}
        <CampaignHero campaign={campaign} />

        {/* Funding Card */}
        <FundingCard campaign={campaign} />

        {/* Creator Actions */}
        {isCreator && <CreatorActions campaign={campaign} onOpenSheet={handleOpenSheet} />}

        {/* Tabs */}
        <div className="space-y-6">
          <Tabs tabs={TABS} defaultTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* Sticky Contribute CTA */}
      {canContribute && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+64px)] left-0 right-0 px-4 pb-2 z-30">
          <div className="max-w-2xl mx-auto">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              onClick={() => handleOpenSheet('contribute')}
              className="shadow-lg shadow-primary/20"
            >
              Contribute
            </Button>
          </div>
        </div>
      )}

      {/* Action Sheets */}
      <ContributeSheet
        campaignId={campaign.id}
        isOpen={openSheet === 'contribute'}
        onClose={() => setOpenSheet(null)}
      />
      <LockCampaignSheet
        campaign={campaign}
        isOpen={openSheet === 'lock'}
        onClose={() => setOpenSheet(null)}
      />
      <ShipSamplesSheet
        campaign={campaign}
        isOpen={openSheet === 'ship'}
        onClose={() => setOpenSheet(null)}
      />
      <UploadCOASheet
        campaign={campaign}
        preSelectedSampleId={selectedSampleId}
        isOpen={openSheet === 'upload-coa'}
        onClose={() => {
          setOpenSheet(null);
          setSelectedSampleId(undefined);
        }}
      />
      <PostUpdateSheet
        campaignId={campaign.id}
        isOpen={openSheet === 'post-update'}
        onClose={() => setOpenSheet(null)}
      />
    </div>
  );
}
