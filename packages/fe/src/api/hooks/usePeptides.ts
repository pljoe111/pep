// State: peptide catalog cache + submission mutation
// Why here: Peptides are used in the wizard combobox (in-memory fuzzy search) and admin panel
// Updates: On app load, fetch all active peptides into stale: Infinity cache

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatePeptideDto, PeptideDto, UpdatePeptideDto } from 'api-client';
import { peptidesApi } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * All active peptides — used by the wizard PeptideCombobox for in-memory fuzzy search.
 * staleTime: Infinity means never refetched unless explicitly invalidated.
 */
export function usePeptides() {
  return useQuery({
    queryKey: queryKeys.peptides.active,
    queryFn: async () => {
      const res = await peptidesApi.getActivePeptides();
      return res.data;
    },
    staleTime: Infinity,
  });
}

/** Admin: all peptides including unreviewed */
export function useAllPeptides(showUnreviewed = false) {
  return useQuery({
    queryKey: queryKeys.peptides.all(showUnreviewed),
    queryFn: async () => {
      const res = await peptidesApi.getAllPeptides(showUnreviewed);
      return res.data;
    },
  });
}

/**
 * User submits a new peptide for review (is_active=false).
 * Campaign continues immediately without waiting for admin approval.
 */
export function useSubmitPeptide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreatePeptideDto): Promise<PeptideDto> => {
      const res = await peptidesApi.submitPeptide(dto);
      return res.data;
    },
    onSuccess: () => {
      // Use prefix ['peptides', 'all'] to match both showUnreviewed=true and false
      void qc.invalidateQueries({ queryKey: ['peptides', 'all'] });
    },
  });
}

/** Admin: create peptide directly (auto-approved) */
export function useCreatePeptide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreatePeptideDto): Promise<PeptideDto> => {
      const res = await peptidesApi.createPeptide(dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.peptides.active });
      void qc.invalidateQueries({ queryKey: ['peptides', 'all'] });
    },
  });
}

/** Admin: update peptide */
export function useUpdatePeptide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdatePeptideDto }): Promise<PeptideDto> => {
      const res = await peptidesApi.updatePeptide(id, dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.peptides.active });
      void qc.invalidateQueries({ queryKey: ['peptides', 'all'] });
    },
  });
}

/** Admin: approve pending peptide */
export function useApprovePeptide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<PeptideDto> => {
      const res = await peptidesApi.approvePeptide(id);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.peptides.active });
      void qc.invalidateQueries({ queryKey: ['peptides', 'all'] });
    },
  });
}

/** Admin: reject (delete) pending peptide */
export function useRejectPeptide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await peptidesApi.rejectPeptide(id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['peptides', 'all'] });
    },
  });
}

/** Admin: disable active peptide */
export function useDisablePeptide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<PeptideDto> => {
      const res = await peptidesApi.disablePeptide(id);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.peptides.active });
      void qc.invalidateQueries({ queryKey: ['peptides', 'all'] });
    },
  });
}

/** Admin: enable disabled peptide */
export function useEnablePeptide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<PeptideDto> => {
      const res = await peptidesApi.enablePeptide(id);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.peptides.active });
      void qc.invalidateQueries({ queryKey: ['peptides', 'all'] });
    },
  });
}

/** Admin: delete disabled peptide (blocked if FK'd to samples) */
export function useDeletePeptide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await peptidesApi.deletePeptide(id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['peptides', 'all'] });
    },
  });
}
