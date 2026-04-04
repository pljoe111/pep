// State: Campaign list, campaign detail, reactions, updates, COAs, contributions
// Why here: Isolates all campaign API calls; components import hooks, never raw API clients
// Updates: Refetch on stale, manual invalidation on mutation success

import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddReactionDto,
  ContributeDto,
  CreateCampaignDto,
  UpdateCampaignDto,
} from 'api-client';
import { campaignsApi } from '../apiClient';
import { queryKeys } from '../queryKeys';
import type { CampaignFilters } from '../queryKeys';

const FEED_STALE_TIME = 5 * 60 * 1000; // 5 minutes for offline support

/** Infinite scroll feed of campaigns */
export function useCampaignFeed(filters: CampaignFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.campaigns.list(filters),
    queryFn: async ({ pageParam = 1 }) => {
      const res = await campaignsApi.getAllCampaigns(
        filters.status,
        filters.search,
        filters.sort,
        pageParam,
        20
      );
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, limit, total } = lastPage;
      const hasMore = page * limit < total;
      return hasMore ? page + 1 : undefined;
    },
    staleTime: FEED_STALE_TIME,
  });
}

/** Single campaign detail */
export function useCampaignDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.campaigns.detail(id),
    queryFn: async () => {
      const res = await campaignsApi.getCampaignById(id);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/** Campaign reaction counts */
export function useCampaignReactions(id: string) {
  return useQuery({
    queryKey: queryKeys.campaigns.reactions(id),
    queryFn: async () => {
      const res = await campaignsApi.getReactions(id);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/** Campaign updates (paginated) */
export function useCampaignUpdates(id: string, page = 1) {
  return useQuery({
    queryKey: queryKeys.campaigns.updates(id),
    queryFn: async () => {
      const res = await campaignsApi.getUpdates(id, page, 20);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/** Campaign COAs */
export function useCampaignCoas(id: string) {
  return useQuery({
    queryKey: queryKeys.campaigns.coas(id),
    queryFn: async () => {
      const res = await campaignsApi.getCoas(id);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/** My campaigns */
export function useMyCampaigns(filters: CampaignFilters) {
  return useQuery({
    queryKey: queryKeys.campaigns.mine(filters),
    queryFn: async () => {
      const res = await campaignsApi.getMyCampaigns(1, 50, filters.status);
      return res.data;
    },
  });
}

/** Verification code for campaign creation */
export function useVerificationCode() {
  return useQuery({
    queryKey: queryKeys.campaigns.verificationCode,
    queryFn: async () => {
      const res = await campaignsApi.getVerificationCode();
      return res.data;
    },
    staleTime: 0, // Always fetch fresh code
  });
}

/** Cost estimate */
export function useCostEstimate(samplesJson: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.campaigns.estimate(samplesJson),
    queryFn: async () => {
      const res = await campaignsApi.estimateCost(samplesJson);
      return res.data;
    },
    enabled: enabled && Boolean(samplesJson),
    staleTime: 30_000,
  });
}

/** Update a campaign's title / description (only allowed in 'created' status) */
export function useUpdateCampaign(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateCampaignDto) => {
      const res = await campaignsApi.updateCampaign(campaignId, dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
      void qc.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    },
  });
}

/** Delete a campaign (only allowed in 'created' status with $0 contributions) */
export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      await campaignsApi.deleteCampaign(campaignId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    },
  });
}

/** Create campaign */
export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateCampaignDto) => {
      const res = await campaignsApi.createCampaign(dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    },
  });
}

/** React to a campaign (optimistic) */
export function useAddReaction(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: AddReactionDto) => {
      const res = await campaignsApi.addReaction(campaignId, dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.campaigns.reactions(campaignId) });
      void qc.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
    },
  });
}

/** Remove a reaction */
export function useRemoveReaction(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (type: string) => {
      await campaignsApi.removeReaction(campaignId, type);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.campaigns.reactions(campaignId) });
      void qc.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
    },
  });
}

/** Contribute to a campaign */
export function useContribute(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: ContributeDto) => {
      const res = await campaignsApi.contribute(campaignId, dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
      void qc.invalidateQueries({ queryKey: queryKeys.wallet.balance });
    },
  });
}
