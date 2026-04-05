import React from 'react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';

interface AdminConfirmModalProps {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

export function AdminConfirmModal({
  title,
  body,
  confirmLabel,
  confirmVariant = 'danger',
  onConfirm,
  onClose,
  isPending,
}: AdminConfirmModalProps): React.ReactElement {
  return (
    <Modal isOpen={true} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div>{body}</div>
        <div className="flex gap-2">
          <Button variant={confirmVariant} fullWidth loading={isPending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
