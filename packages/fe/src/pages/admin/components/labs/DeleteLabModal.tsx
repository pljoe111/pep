import React from 'react';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';

interface DeleteLabModalProps {
  labName: string;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

export function DeleteLabModal({
  labName,
  onConfirm,
  onClose,
  isPending,
}: DeleteLabModalProps): React.ReactElement {
  return (
    <AdminConfirmModal
      title="Delete Lab"
      body={
        <p className="text-sm text-text">
          <strong>{labName}</strong> will be permanently removed. This will fail if the lab still
          has test records attached.
        </p>
      }
      confirmLabel="Delete Permanently"
      confirmVariant="danger"
      onConfirm={onConfirm}
      onClose={onClose}
      isPending={isPending}
    />
  );
}
