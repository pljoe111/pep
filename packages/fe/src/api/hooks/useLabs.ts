// State: lab list, lab detail with test menu
// Why here: Used in campaign creation wizard for lab/test picker
// Updates: approvedOnly filter toggles on campaign creation context

import { useQuery } from '@tanstack/react-query';
import { labsApi, testsApi } from '../apiClient';
import { queryKeys } from '../queryKeys';

/** All approved labs (for campaign creation picker) */
export function useLabs(approvedOnly = true) {
  return useQuery({
    queryKey: queryKeys.labs.all(approvedOnly),
    queryFn: async () => {
      const res = await labsApi.getAllLabs(approvedOnly, 1, 100);
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

/** Active test catalog */
export function useTests() {
  return useQuery({
    queryKey: queryKeys.tests.all,
    queryFn: async () => {
      const res = await testsApi.getAllTests(true);
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}
