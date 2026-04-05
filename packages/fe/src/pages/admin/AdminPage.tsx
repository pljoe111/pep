import React from 'react';
import { Tabs } from '../../components/ui/Tabs';
import { AppShell } from '../../components/layout/AppShell';
import { PageContainer } from '../../components/layout/PageContainer';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { CampaignsTab } from './tabs/CampaignsTab';
import { LabsTab } from './tabs/LabsTab';
import { PeptidesTab } from './tabs/PeptidesTab';
import { VendorsTab } from './tabs/VendorsTab';
import { UsersTab } from './tabs/UsersTab';
import { ConfigTab } from './tabs/ConfigTab';
import { ActionsTab } from './tabs/ActionsTab';

export function AdminPage(): React.ReactElement {
  const { user } = useAuth();
  const isAdmin = (user?.claims ?? []).includes('admin');

  if (!isAdmin) {
    return (
      <AppShell>
        <PageContainer>
          <EmptyState
            heading="Access Denied"
            subtext="You do not have permission to view this page."
          />
        </PageContainer>
      </AppShell>
    );
  }

  const tabs = [
    { id: 'campaigns', label: 'Campaigns', content: <CampaignsTab /> },
    { id: 'labs', label: 'Labs', content: <LabsTab /> },
    { id: 'peptides', label: 'Peptides', content: <PeptidesTab /> },
    { id: 'vendors', label: 'Vendors', content: <VendorsTab /> },
    { id: 'users', label: 'Users', content: <UsersTab /> },
    { id: 'config', label: 'Config', content: <ConfigTab /> },
    { id: 'actions', label: 'Actions', content: <ActionsTab /> },
  ];

  return (
    <AppShell>
      <PageContainer>
        <h1 className="text-xl font-bold text-text mb-4">Admin Panel</h1>
        <Tabs tabs={tabs} defaultTab="campaigns" />
      </PageContainer>
    </AppShell>
  );
}
