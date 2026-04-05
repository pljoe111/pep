import React from 'react';
import type { UserDto } from 'api-client';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';

interface BanUserModalProps {
  user: UserDto;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function BanUserModal({
  user,
  onClose,
  onConfirm,
  isPending,
}: BanUserModalProps): React.ReactElement {
  return (
    <AdminConfirmModal
      title="Ban User"
      body={
        <p className="text-sm text-text">
          Banning <strong>{user.username ?? user.email}</strong> will immediately revoke all active
          sessions.
        </p>
      }
      confirmLabel="Ban User"
      confirmVariant="danger"
      onConfirm={onConfirm}
      onClose={onClose}
      isPending={isPending}
    />
  );
}
