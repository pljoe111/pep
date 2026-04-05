import React from 'react';
import type { UserDto } from 'api-client';
import { Card } from '../../../../components/ui/Card';
import { Badge } from '../../../../components/ui/Badge';
import { AdminActionButton } from '../shared/AdminActionButton';
import { useAdminBanUser } from '../../../../api/hooks/useAdmin';
import { useToast } from '../../../../hooks/useToast';

interface UserRowProps {
  user: UserDto;
  onBan: (u: UserDto) => void;
  onView: (u: UserDto) => void;
}

function extractApiError(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message ===
      'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function UserRow({ user, onBan, onView }: UserRowProps): React.ReactElement {
  const banMutation = useAdminBanUser();
  const toast = useToast();

  const handleUnban = (): void => {
    banMutation.mutate(
      { id: user.id, dto: { banned: false } },
      {
        onSuccess: () => toast.success(`${user.username ?? user.email} unbanned`),
        onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to unban')),
      }
    );
  };

  return (
    <Card padding="sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text">{user.username ?? 'No username'}</p>
          <p className="text-xs text-text-2 mt-0.5">{user.email}</p>
          <p className="text-xs text-text-3 mt-0.5">
            Joined {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1.5">
            {user.email_verified ? (
              <Badge variant="green">Email Verified</Badge>
            ) : (
              <Badge variant="amber">Unverified</Badge>
            )}
            {user.is_banned && <Badge variant="red">Banned</Badge>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AdminActionButton variant="ghost" onClick={() => onView(user)}>
              View
            </AdminActionButton>
            {user.is_banned ? (
              <AdminActionButton
                variant="ghost"
                loading={banMutation.isPending}
                onClick={handleUnban}
              >
                Unban
              </AdminActionButton>
            ) : (
              <AdminActionButton variant="danger" onClick={() => onBan(user)}>
                Ban
              </AdminActionButton>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
