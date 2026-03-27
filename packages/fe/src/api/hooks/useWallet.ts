// State: wallet balance, deposit address, transaction history, withdraw mutation
// Why here: Isolates wallet API calls; invalidated after contributions
// Updates: Refetch on window focus; transactions refetch after withdraw success

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WithdrawDto } from 'api-client';
import { walletApi } from '../apiClient';
import { queryKeys } from '../queryKeys';
import type { TxFilters } from '../queryKeys';

/** Current wallet balances */
export function useWalletBalance() {
  return useQuery({
    queryKey: queryKeys.wallet.balance,
    queryFn: async () => {
      const res = await walletApi.getBalance();
      return res.data;
    },
    staleTime: 30_000,
  });
}

/** Deposit address + QR hint */
export function useDepositAddress() {
  return useQuery({
    queryKey: queryKeys.wallet.depositAddress,
    queryFn: async () => {
      const res = await walletApi.getDepositAddress();
      return res.data;
    },
    staleTime: Infinity, // Address never changes
  });
}

/** Paginated transaction history */
export function useTransactions(filters: TxFilters) {
  return useQuery({
    queryKey: queryKeys.wallet.transactions(filters),
    queryFn: async () => {
      const res = await walletApi.getTransactions(filters.page ?? 1, 20, filters.type);
      return res.data;
    },
  });
}

/** Submit a withdrawal */
export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: WithdrawDto) => {
      const res = await walletApi.withdraw(dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.wallet.balance });
      void qc.invalidateQueries({ queryKey: ['wallet', 'transactions'] });
    },
  });
}
