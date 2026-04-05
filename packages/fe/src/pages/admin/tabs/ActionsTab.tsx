import React, { useState, type ChangeEvent } from 'react';
import { useAdminConfig, useAdminFeeSweep } from '../../../api/hooks/useAdmin';
import { useToast } from '../../../hooks/useToast';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { AdminConfirmModal } from '../components/shared/AdminConfirmModal';

function extractApiError(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message ===
      'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function ActionsTab(): React.ReactElement {
  const [destinationAddress, setDestinationAddress] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: configData } = useAdminConfig();
  const sweepMutation = useAdminFeeSweep();
  const toast = useToast();

  const feeBalance: unknown = configData?.find(
    (c) => c.config_key === 'fee_account_balance'
  )?.config_value;

  const handleSweep = async (): Promise<void> => {
    if (!destinationAddress.trim()) {
      toast.error('Destination address is required');
      return;
    }
    try {
      await sweepMutation.mutateAsync({
        destination_address: destinationAddress.trim(),
        currency: 'usdc',
      });
      toast.success('USDC fee sweep completed');
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'USDC sweep failed'));
    }
    try {
      await sweepMutation.mutateAsync({
        destination_address: destinationAddress.trim(),
        currency: 'usdt',
      });
      toast.success('USDT fee sweep completed');
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'USDT sweep failed'));
    }
    setShowConfirm(false);
  };

  return (
    <div className="space-y-4">
      <Card padding="md">
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-text">Manual Fee Sweep</h3>
            <p className="text-sm text-text-2 mt-1">
              Transfer accumulated platform fees from the fee account to the master wallet.
            </p>
          </div>
          <div>
            <p className="text-xs text-text-3">Fee Account Balance</p>
            <p className="text-sm font-bold text-text">
              {feeBalance !== undefined ? JSON.stringify(feeBalance) : 'N/A'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-text block mb-1">Destination Address</label>
            <input
              type="text"
              value={destinationAddress}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDestinationAddress(e.target.value)}
              placeholder="Enter wallet address..."
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface font-mono min-h-[44px]"
            />
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={() => setShowConfirm(true)}
            disabled={!destinationAddress.trim()}
          >
            Run Fee Sweep
          </Button>
        </div>
      </Card>

      {showConfirm && (
        <AdminConfirmModal
          title="Confirm Fee Sweep"
          body={
            <p className="text-sm text-text">
              This will sweep all USDC and USDT fees to the specified address. This cannot be
              undone.
            </p>
          }
          confirmLabel="Run Fee Sweep"
          confirmVariant="primary"
          onConfirm={() => {
            void handleSweep();
          }}
          onClose={() => setShowConfirm(false)}
          isPending={sweepMutation.isPending}
        />
      )}
    </div>
  );
}
