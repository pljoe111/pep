// State: lab list, lab detail with test menu
// Why here: Used in campaign creation wizard for lab/test picker
// Updates: approvedOnly filter toggles on campaign creation context

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../axiosInstance';
import { labsApi, testsApi } from '../apiClient';
import { queryKeys } from '../queryKeys';
import type { TestClaimTemplateDto, ClaimKind } from 'api-client';

/** All labs (for admin panel) */
export function useLabs(approvedOnly = false, activeOnly = true) {
  return useQuery({
    queryKey: queryKeys.labs.all(approvedOnly, activeOnly),
    queryFn: async () => {
      const res = await labsApi.getAllLabs(approvedOnly, activeOnly, 1, 100);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Lab detail with test menu */
export function useLabDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.labs.detail(id),
    queryFn: async () => {
      const res = await labsApi.getLabById(id);
      return res.data;
    },
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Test catalog.
 * @param activeOnly - pass `true` (default) for campaign creation; pass `false` in
 *   the admin panel when "Show Disabled" is toggled on.
 */
export function useTests(activeOnly = true) {
  return useQuery({
    queryKey: queryKeys.tests.all(activeOnly),
    queryFn: async () => {
      const res = await testsApi.getAllTests(activeOnly);
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Approve a pending lab */
export function useApproveLab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (labId: string) => {
      await labsApi.approve(labId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.labs.all(false, true) });
      void qc.invalidateQueries({ queryKey: queryKeys.labs.all(false, false) });
    },
  });
}

/** Deactivate (soft delete) a lab test */
export function useDeactivateLabTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ labId, testId }: { labId: string; testId: string }) => {
      await labsApi.deactivateTest(labId, testId);
    },
    onSuccess: (_, { labId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.labs.detail(labId) });
    },
  });
}

/** Deactivate (soft delete) a lab */
export function useDeactivateLab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (labId: string) => {
      await labsApi.deactivateLab(labId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.labs.all(false, true) });
      void qc.invalidateQueries({ queryKey: queryKeys.labs.all(false, false) });
    },
  });
}

/** Reactivate a lab */
export function useReactivateLab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (labId: string) => {
      await labsApi.reactivateLab(labId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.labs.all(false, true) });
      void qc.invalidateQueries({ queryKey: queryKeys.labs.all(false, false) });
    },
  });
}

/** Reactivate a lab test */
export function useReactivateLabTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ labId, testId }: { labId: string; testId: string }) => {
      await labsApi.reactivateLabTest(labId, testId);
    },
    onSuccess: (_, { labId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.labs.detail(labId) });
    },
  });
}

/** Disable a test type (cascades to all associated lab-tests) */
export function useDisableTest() {
  const qc = useQueryClient();
  return useMutation({
    // Use axiosInstance directly — generated client return type doesn't resolve cleanly
    mutationFn: async (testId: string) => {
      await axiosInstance.post<void>(`/tests/${testId}/disable`);
    },
    onSuccess: () => {
      // Invalidate all tests queries (both activeOnly variants)
      void qc.invalidateQueries({ queryKey: ['tests'] });
      // Invalidate ALL labs queries — prefix match flushes both the list AND any open
      // lab detail (queryKeys.labs.detail) so the EditLabModal shows the updated state.
      void qc.invalidateQueries({ queryKey: ['labs'] });
    },
  });
}

/** Enable a test type */
export function useEnableTest() {
  const qc = useQueryClient();
  return useMutation({
    // Use axiosInstance directly — generated client return type doesn't resolve cleanly
    mutationFn: async (testId: string) => {
      await axiosInstance.post<void>(`/tests/${testId}/enable`);
    },
    onSuccess: () => {
      // Invalidate all tests queries (both activeOnly=true and activeOnly=false variants)
      void qc.invalidateQueries({ queryKey: ['tests'] });
    },
  });
}

/**
 * Permanently delete a lab.
 * Backend guard: fails with 409 if any lab-test records still exist.
 * Call POST /labs/:id/delete (not in generated client — uses axiosInstance directly).
 */
export function useDeleteLab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (labId: string) => {
      await axiosInstance.post(`/labs/${labId}/delete`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['labs'] });
    },
  });
}

/**
 * Permanently delete a disabled lab-test record.
 * Backend guard: fails with 409 if the lab-test is still active.
 * Calls POST /labs/:labId/tests/:testId/delete (not in generated client — uses axiosInstance directly).
 */
export function useDeleteLabTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ labId, testId }: { labId: string; testId: string }) => {
      await axiosInstance.post<void>(`/labs/${labId}/tests/${testId}/delete`);
    },
    onSuccess: (_, { labId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.labs.detail(labId) });
    },
  });
}

/**
 * Permanently delete a test type.
 * Backend guard: fails with 409 if any lab-test records reference it.
 * Call DELETE /tests/:id (not in generated client — uses axiosInstance directly).
 */
export function useDeleteTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (testId: string) => {
      await axiosInstance.delete(`/tests/${testId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tests'] });
    },
  });
}

/** Fetch claim templates for a test */
export function useTestClaimTemplates(testId: string) {
  return useQuery({
    queryKey: queryKeys.tests.claimTemplates(testId),
    queryFn: async () => {
      const res = await axiosInstance.get<TestClaimTemplateDto[]>(
        `/tests/${testId}/claim-templates`
      );
      return res.data;
    },
    enabled: Boolean(testId),
    staleTime: 5 * 60 * 1000,
  });
}

/** Add a claim template to a test */
export function useCreateTestClaimTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      testId,
      claim_kind,
      label,
      is_required,
      sort_order,
    }: {
      testId: string;
      claim_kind: ClaimKind;
      label: string;
      is_required: boolean;
      sort_order: number;
    }) => {
      const res = await axiosInstance.post<TestClaimTemplateDto>(
        `/tests/${testId}/claim-templates`,
        {
          claim_kind,
          label,
          is_required,
          sort_order,
        }
      );
      return res.data;
    },
    onSuccess: (_, { testId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.tests.claimTemplates(testId) });
      void qc.invalidateQueries({ queryKey: queryKeys.tests.all(false) });
      void qc.invalidateQueries({ queryKey: queryKeys.tests.all(true) });
    },
  });
}

/** Delete a claim template */
export function useDeleteTestClaimTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, testId }: { templateId: string; testId: string }) => {
      await axiosInstance.delete(`/tests/claim-templates/${templateId}`);
      return testId;
    },
    onSuccess: (testId: string) => {
      void qc.invalidateQueries({ queryKey: queryKeys.tests.claimTemplates(testId) });
      void qc.invalidateQueries({ queryKey: queryKeys.tests.all(false) });
      void qc.invalidateQueries({ queryKey: queryKeys.tests.all(true) });
    },
  });
}
