import React from 'react';
import type { TestDto } from 'api-client';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';

interface DeleteTestModalProps {
  test: TestDto;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteTestModal({
  test,
  onClose,
  onConfirm,
  isPending,
}: DeleteTestModalProps): React.ReactElement {
  return (
    <AdminConfirmModal
      title="Delete Test"
      body={
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-surface-a border border-border">
            <p className="text-sm font-bold text-danger mb-1">Permanent Deletion</p>
            <p className="text-sm text-text">
              {test.name} will be permanently removed from the test catalog.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-sm font-bold text-warning mb-1">⚠ Lab cascade</p>
            <p className="text-sm text-text-2">
              This test will be automatically removed from every lab that lists it. Only blocked if
              the test has been used in an active campaign.
            </p>
          </div>
        </div>
      }
      confirmLabel="Delete Permanently"
      confirmVariant="danger"
      onConfirm={onConfirm}
      onClose={onClose}
      isPending={isPending}
    />
  );
}
