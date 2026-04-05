import React from 'react';
import type { UserDto } from 'api-client';
import { Modal } from '../../../../components/ui/Modal';
import { Badge } from '../../../../components/ui/Badge';

interface UserDetailModalProps {
  user: UserDto;
  onClose: () => void;
}

export function UserDetailModal({ user, onClose }: UserDetailModalProps): React.ReactElement {
  return (
    <Modal isOpen={true} onClose={onClose} title="User Details" size="md">
      <div className="space-y-4">
        <div>
          <p className="text-xs text-text-3">Email</p>
          <p className="text-sm text-text">{user.email}</p>
        </div>
        <div>
          <p className="text-xs text-text-3">Username</p>
          <p className="text-sm text-text">{user.username ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-text-3">Joined</p>
          <p className="text-sm text-text">{new Date(user.created_at).toLocaleDateString()}</p>
        </div>
        <div>
          <p className="text-xs text-text-3">Email Status</p>
          <div className="mt-1">
            {user.email_verified ? (
              <Badge variant="green">Email Verified</Badge>
            ) : (
              <Badge variant="amber">Unverified</Badge>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-text-3">Claims</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {user.claims.length > 0 ? (
              user.claims.map((c) => (
                <Badge key={c} variant="blue">
                  {c}
                </Badge>
              ))
            ) : (
              <p className="text-xs text-text-3">No claims</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
