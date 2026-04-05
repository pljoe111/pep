import React from 'react';
import type { UserDto } from 'api-client';
import { AdminEmptyState } from '../shared/AdminEmptyState';
import { UserRow } from './UserRow';

interface UserListProps {
  users: UserDto[];
  onBan: (u: UserDto) => void;
  onView: (u: UserDto) => void;
}

export function UserList({ users, onBan, onView }: UserListProps): React.ReactElement {
  if (users.length === 0) {
    return <AdminEmptyState message="No users found" />;
  }

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <UserRow key={u.id} user={u} onBan={onBan} onView={onView} />
      ))}
    </div>
  );
}
