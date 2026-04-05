import React, { useState, type ChangeEvent } from 'react';
import type { PeptideDto } from 'api-client';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';
import { Textarea } from '../../../../components/ui/Textarea';

interface RejectPeptideModalProps {
  peptide: PeptideDto;
  onClose: () => void;
  onConfirm: (notes?: string) => void;
  isPending: boolean;
}

export function RejectPeptideModal({
  peptide,
  onClose,
  onConfirm,
  isPending,
}: RejectPeptideModalProps): React.ReactElement {
  const [notes, setNotes] = useState('');

  return (
    <AdminConfirmModal
      title="Reject Peptide"
      body={
        <div className="space-y-3">
          <p className="text-sm text-text">Submitter will be notified of the rejection.</p>
          <div>
            <label className="text-sm font-medium text-text block mb-1">
              Review Notes (optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              rows={3}
              placeholder="Reason for rejection..."
            />
          </div>
        </div>
      }
      confirmLabel="Reject"
      confirmVariant="danger"
      onConfirm={() => onConfirm(notes.trim() || undefined)}
      onClose={onClose}
      isPending={isPending}
    />
  );
}
