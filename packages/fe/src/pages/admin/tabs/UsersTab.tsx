import React, { useState, useMemo, type ChangeEvent } from 'react';
import type { UserDto } from 'api-client';
import { useAdminUsers, useAdminBanUser } from '../../../api/hooks/useAdmin';
import { useDebounce } from '../../../hooks/useDebounce';
import { useToast } from '../../../hooks/useToast';
import { Spinner } from '../../../components/ui/Spinner';
import { AdminFilterBar } from '../components/shared/AdminFilterBar';
import { UserList } from '../components/users/UserList';
import { BanUserModal } from '../components/users/BanUserModal';
import { UserDetailModal } from '../components/users/UserDetailModal';

const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Banned', value: 'banned' },
  { label: 'Unverified', value: 'unverified' },
];

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

export function UsersTab(): React.ReactElement {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'banned' | 'unverified'>('all');
  const [banTarget, setBanTarget] = useState<UserDto | null>(null);
  const [viewTarget, setViewTarget] = useState<UserDto | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading } = useAdminUsers(debouncedSearch);
  const banMutation = useAdminBanUser();
  const toast = useToast();

  const users: UserDto[] = useMemo(() => {
    const allUsers: UserDto[] = (data as { data?: UserDto[] })?.data ?? [];
    if (filter === 'banned') return allUsers.filter((u) => u.is_banned);
    if (filter === 'unverified') return allUsers.filter((u) => !u.email_verified);
    return allUsers;
  }, [data, filter]);

  const handleBan = (): void => {
    if (!banTarget) return;
    banMutation.mutate(
      { id: banTarget.id, dto: { banned: true } },
      {
        onSuccess: () => {
          toast.success(`${banTarget.username ?? banTarget.email} banned`);
          setBanTarget(null);
        },
        onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to ban user')),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by email or username..."
        value={search}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-border px-4 py-3 text-sm text-text bg-surface min-h-[44px]"
      />
      <AdminFilterBar
        options={FILTER_OPTIONS}
        value={filter}
        onChange={(v) => setFilter(v as 'all' | 'banned' | 'unverified')}
      />

      <UserList users={users} onBan={(u) => setBanTarget(u)} onView={(u) => setViewTarget(u)} />

      {banTarget && (
        <BanUserModal
          user={banTarget}
          onClose={() => setBanTarget(null)}
          onConfirm={handleBan}
          isPending={banMutation.isPending}
        />
      )}

      {viewTarget && <UserDetailModal user={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}
