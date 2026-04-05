import React, { useState, type ChangeEvent } from 'react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Textarea } from '../../../../components/ui/Textarea';

interface CampaignFlagModalProps {
  campaignId: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}

export function CampaignFlagModal({
  onClose,
  onConfirm,
  isPending,
}: CampaignFlagModalProps): React.ReactElement {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (): void => {
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    onConfirm(reason.trim());
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    setReason(e.target.value);
    setError('');
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Flag Campaign" size="md">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-text block mb-1">
            Reason <span className="text-danger">*</span>
          </label>
          <Textarea
            value={reason}
            onChange={handleChange}
            rows={3}
            placeholder="Why are you flagging this campaign?"
            error={error}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" fullWidth loading={isPending} onClick={handleSubmit}>
            Flag Campaign
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
