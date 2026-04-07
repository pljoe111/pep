// State: Centralized TanStack Query key registry
// Why here: Single source of truth for all query keys prevents key collisions and enables
//           precise cache invalidation from anywhere in the app
// Updates: Extended when new queries are added

export interface CampaignFilters {
  status?: string;
  search?: string;
  sort?: string;
}

export interface TxFilters {
  type?: string;
  page?: number;
}

export const queryKeys = {
  campaigns: {
    all: ['campaigns'] as const,
    list: (filters: CampaignFilters) => ['campaigns', 'list', filters] as const,
    detail: (id: string) => ['campaigns', id] as const,
    contributions: (id: string) => ['campaigns', id, 'contributions'] as const,
    reactions: (id: string) => ['campaigns', id, 'reactions'] as const,
    updates: (id: string) => ['campaigns', id, 'updates'] as const,
    coas: (id: string) => ['campaigns', id, 'coas'] as const,
    estimate: (samples: string) => ['campaigns', 'estimate', samples] as const,
    verificationCode: ['campaigns', 'verification-code'] as const,
    mine: (filters: CampaignFilters) => ['campaigns', 'mine', filters] as const,
    byCreator: (creatorId: string) => ['campaigns', 'byCreator', creatorId] as const,
  },
  wallet: {
    balance: ['wallet', 'balance'] as const,
    transactions: (filters: TxFilters) => ['wallet', 'transactions', filters] as const,
    depositAddress: ['wallet', 'deposit-address'] as const,
  },
  auth: {
    me: ['auth', 'me'] as const,
  },
  notifications: {
    list: (page: number) => ['notifications', page] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  labs: {
    all: (approvedOnly: boolean, activeOnly: boolean) =>
      ['labs', approvedOnly, activeOnly] as const,
    detail: (id: string) => ['labs', id] as const,
  },
  tests: {
    all: (activeOnly: boolean) => ['tests', activeOnly] as const,
    claimTemplates: (testId: string) => ['tests', testId, 'claim-templates'] as const,
  },
  peptides: {
    active: ['peptides', 'active'] as const,
    all: (showUnreviewed?: boolean) => ['peptides', 'all', showUnreviewed ?? false] as const,
  },
  vendors: {
    search: (q: string) => ['vendors', 'search', q] as const,
    all: (status?: string) => ['vendors', 'all', status ?? 'all'] as const,
    detail: (id: string) => ['vendors', id] as const,
  },
  admin: {
    campaigns: (filters: CampaignFilters & { flagged?: boolean }) =>
      ['admin', 'campaigns', filters] as const,
    config: ['admin', 'config'] as const,
    users: (search?: string) => ['admin', 'users', search ?? ''] as const,
    userCampaigns: (userId: string, filters: { status?: string; page?: number }) =>
      ['admin', 'users', userId, 'campaigns', filters] as const,
    treasury: ['admin', 'treasury'] as const,
    coas: (filters: { status?: string; page?: number }) => ['admin', 'coas', filters] as const,
  },
  users: {
    profile: (id: string) => ['users', id, 'profile'] as const,
  },
  appInfo: ['app-info'] as const,
} as const;
