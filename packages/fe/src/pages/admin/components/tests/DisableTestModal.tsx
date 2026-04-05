import React from 'react';
import type { TestDto } from 'api-client';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';

interface DisableTestModalProps {
  test: TestDto;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DisableTestModal({
  test,
  onClose,
  onConfirm,
  isPending,
}: DisableTestModalProps): React.ReactElement {
  return (
    <AdminConfirmModal
      title="Disable Test"
      body={
        <p className="text-sm text-text">
          Disabling <strong>{test.name}</strong> will immediately deactivate this test across all
          labs that currently offer it.
        </p>
      }
      confirmLabel="Disable Everywhere"
      confirmVariant="danger"
      onConfirm={onConfirm}
      onClose={onClose}
      isPending={isPending}
    />
  );
}
