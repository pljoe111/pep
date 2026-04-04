// State: admin campaign list, config, COA verification actions, user management
// Why here: All admin mutations are isolated; only used inside admin-guarded routes
// Updates: Mutations invalidate relevant queries on success

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminBanUserDto,
  AdminClaimDto,
  AdminFeeSweepDto,
  AdminHideCampaignDto,
  AdminRefundDto,
  AdminUpdateConfigDto,
  AdminVerifyCoaDto,
} from 'api-client';
import { adminApi } from '../apiClient';
import { queryKeys } from '../queryKeys';

/** Admin: get users with optional search */
export function useAdminUsers(search?: string) {
  return useQuery({
    queryKey: queryKeys.admin.users(search),
    queryFn: async () => {
      const res = await adminApi.getUsers(search ?? '');
      return res.data;
    },
  });
}

/** Admin: all campaigns with optional filters */
export function useAdminCampaigns(
  filters: { status?: string; flagged?: boolean; page?: number } = {}
) {
  return useQuery({
    queryKey: queryKeys.admin.campaigns(filters),
    queryFn: async () => {
      const res = await adminApi.getCampaigns(
        filters.status,
        filters.flagged,
        filters.page ?? 1,
        20
      );
      return res.data;
    },
  });
}

/** Admin: get user's campaigns */
export function useAdminUserCampaigns(
  userId: string,
  filters: { status?: string; page?: number } = {}
) {
  return useQuery({
    queryKey: queryKeys.admin.userCampaigns(userId, filters),
    queryFn: async () => {
      const res = await adminApi.getUserCampaigns(userId, filters.status, filters.page ?? 1, 20);
      return res.data;
    },
    enabled: Boolean(userId),
  });
}

/** Admin: platform config */
export function useAdminConfig() {
  return useQuery({
    queryKey: queryKeys.admin.config,
    queryFn: async () => {
      const res = await adminApi.getConfig();
      return res.data;
    },
  });
}

/** Admin: force-refund a campaign */
export function useAdminRefundCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: AdminRefundDto }) => {
      const res = await adminApi.refundCampaign(id, dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.campaigns({}) });
    },
  });
}

/** Admin: hide/unhide a campaign */
export function useAdminHideCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: AdminHideCampaignDto }) => {
      const res = await adminApi.hideCampaign(id, dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.campaigns({}) });
    },
  });
}

/** Admin: flag/unflag a campaign */
export function useAdminFlagCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: { flagged: boolean; reason?: string } }) => {
      const res = await adminApi.flagCampaign(id, dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.campaigns({}) });
    },
  });
}

/** Admin: verify a COA */
export function useAdminVerifyCoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: AdminVerifyCoaDto }) => {
      const res = await adminApi.verifyCoa(id, dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.campaigns({}) });
    },
  });
}

/** Admin: ban/unban user */
export function useAdminBanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: AdminBanUserDto }) => {
      const res = await adminApi.banUser(id, dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

/** Admin: grant/revoke user claim */
export function useAdminManageClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: AdminClaimDto }) => {
      const res = await adminApi.manageClaim(id, dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

/** Admin: update config value */
export function useAdminUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, dto }: { key: string; dto: AdminUpdateConfigDto }) => {
      const res = await adminApi.updateConfig(key, dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.config });
    },
  });
}

/** Admin: fee sweep */
export function useAdminFeeSweep() {
  return useMutation({
    mutationFn: async (dto: AdminFeeSweepDto) => {
      const res = await adminApi.sweepFees(dto);
      return res.data;
    },
  });
}
