import React, { useState, type ChangeEvent } from 'react';
import type { CampaignDetailDto } from 'api-client';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Textarea } from '../../../../components/ui/Textarea';
import { formatUSD } from '../../../../lib/formatters';

interface CampaignRefundModalProps {
  campaign: CampaignDetailDto;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}

export function CampaignRefundModal({
  campaign,
  onClose,
  onConfirm,
  isPending,
}: CampaignRefundModalProps): React.ReactElement {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (): void => {
    if (!reason.trim()) {
      setError('Refund reason is required');
      return;
    }
    onConfirm(reason.trim());
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    setReason(e.target.value);
    setError('');
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Refund Campaign" size="md">
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm text-warning">
            ⚠ This will refund all contributors and mark the campaign as refunded. This cannot be
            undone.
          </p>
        </div>
        <p className="text-sm text-text">
          Current funding: <strong>{formatUSD(campaign.current_funding_usd)}</strong>
        </p>
        <div>
          <label className="text-sm font-medium text-text block mb-1">
            Refund reason <span className="text-danger">*</span>
          </label>
          <Textarea
            value={reason}
            onChange={handleChange}
            rows={3}
            placeholder="Reason for refund..."
            error={error}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="danger" fullWidth loading={isPending} onClick={handleSubmit}>
            Confirm Refund
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
