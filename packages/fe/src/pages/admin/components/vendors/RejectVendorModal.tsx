import React, { useState, type ChangeEvent } from 'react';
import type { VendorDto } from 'api-client';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';
import { Textarea } from '../../../../components/ui/Textarea';

interface RejectVendorModalProps {
  vendor: VendorDto;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  isPending: boolean;
}

export function RejectVendorModal({
  vendor,
  onClose,
  onConfirm,
  isPending,
}: RejectVendorModalProps): React.ReactElement {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (): void => {
    if (!notes.trim()) {
      setError('Review notes are required');
      return;
    }
    onConfirm(notes.trim());
  };

  return (
    <AdminConfirmModal
      title="Reject Vendor"
      body={
        <div className="space-y-3">
          <p className="text-sm text-text">
            Reject <strong>{vendor.name}</strong>.
          </p>
          <div>
            <label className="text-sm font-medium text-text block mb-1">
              Review Notes <span className="text-danger">*</span>
            </label>
            <Textarea
              value={notes}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                setNotes(e.target.value);
                setError('');
              }}
              rows={3}
              placeholder="Reason for rejection..."
              error={error}
            />
          </div>
        </div>
      }
      confirmLabel="Reject Vendor"
      confirmVariant="danger"
      onConfirm={handleSubmit}
      onClose={onClose}
      isPending={isPending}
    />
  );
}
