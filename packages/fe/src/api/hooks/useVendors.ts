// State: vendor search results + submission mutation
// Why here: Vendors are used in the wizard combobox (debounced API search) and admin panel
// Updates: search queries are debounced 300ms in the combobox component

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateVendorDto, ReviewVendorDto, UpdateVendorDto, VendorDto } from 'api-client';
import { vendorsApi } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * Debounced vendor search — called from VendorCombobox.
 * Only fires when q is non-empty.
 */
export function useVendorSearch(q: string, limit = 10) {
  return useQuery({
    queryKey: queryKeys.vendors.search(q),
    queryFn: async () => {
      const res = await vendorsApi.searchVendors(q, limit);
      return res.data;
    },
    staleTime: 30 * 1000,
  });
}

/** Admin: full vendor list with optional status filter */
export function useAllVendors(status?: 'pending' | 'approved' | 'rejected') {
  return useQuery({
    queryKey: queryKeys.vendors.all(status),
    queryFn: async () => {
      const res = await vendorsApi.getAllVendors(status);
      return res.data;
    },
  });
}

/** Admin: vendor detail */
export function useVendorDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.vendors.detail(id),
    queryFn: async () => {
      const res = await vendorsApi.getVendorById(id);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * User submits a new vendor (status=pending).
 * Campaign wizard proceeds immediately.
 */
export function useSubmitVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateVendorDto): Promise<VendorDto> => {
      const res = await vendorsApi.submitVendor(dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.all() });
    },
  });
}

/** Admin: create vendor directly (auto-approved) */
export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateVendorDto): Promise<VendorDto> => {
      const res = await vendorsApi.createVendor(dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.all() });
    },
  });
}

/** Admin: update vendor */
export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateVendorDto }): Promise<VendorDto> => {
      const res = await vendorsApi.updateVendor(id, dto);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.detail(id) });
    },
  });
}

/** Admin: approve or reject a vendor */
export function useReviewVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: ReviewVendorDto }): Promise<VendorDto> => {
      const res = await vendorsApi.reviewVendor(id, dto);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.detail(id) });
    },
  });
}

/** Admin: reinstate a suspended vendor (set approved) */
export function useReinstateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<VendorDto> => {
      const res = await vendorsApi.reinstateVendor(id);
      return res.data;
    },
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.detail(id) });
    },
  });
}

/** Admin: delete vendor (blocked if samples attached) */
export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await vendorsApi.deleteVendor(id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.all() });
    },
  });
}
