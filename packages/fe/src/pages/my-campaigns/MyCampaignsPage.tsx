import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageContainer } from '../../components/layout/PageContainer';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useMyCampaigns } from '../../api/hooks/useCampaigns';
import { MyCampaignsFilters } from './components/MyCampaignsFilters';
import { CampaignListItem } from './components/CampaignListItem';
import { EditCampaignSheet } from './components/EditCampaignSheet';
import { DeleteCampaignConfirm } from './components/DeleteCampaignConfirm';
import type { CampaignListDto } from 'api-client';

export default function MyCampaignsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [editTarget, setEditTarget] = useState<CampaignListDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CampaignListDto | null>(null);

  const { data, isLoading } = useMyCampaigns({ status: statusFilter || undefined });
  const campaigns = data?.data || [];

  return (
    <AppShell>
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-text">My Campaigns</h1>
          <Button variant="primary" size="md" onClick={() => navigate('/create')}>
            + New
          </Button>
        </div>

        <MyCampaignsFilters value={statusFilter} onChange={setStatusFilter} />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            heading={
              statusFilter
                ? `No ${statusFilter} campaigns found.`
                : "You haven't created any campaigns yet."
            }
            subtext={
              statusFilter ? 'Try changing your filters.' : 'Start a new campaign to get funded.'
            }
            ctaLabel="Create your first campaign"
            onCta={() => navigate('/create')}
          />
        ) : (
          <div className="space-y-1">
            {campaigns.map((c) => (
              <CampaignListItem
                key={c.id}
                campaign={c}
                onEdit={() => setEditTarget(c)}
                onDelete={() => setDeleteTarget(c)}
              />
            ))}
          </div>
        )}

        <EditCampaignSheet
          campaign={editTarget}
          isOpen={editTarget !== null}
          onClose={() => setEditTarget(null)}
        />
        <DeleteCampaignConfirm
          campaign={deleteTarget}
          isOpen={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
        />
      </PageContainer>
    </AppShell>
  );
}
