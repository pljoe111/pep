import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useUpdateUsername } from '../../../api/hooks/useUser';
import { Avatar } from '../../../components/ui/Avatar';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';
import { formatDate } from '../../../lib/formatters';

export function ProfileSection() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const updateUsernameMutation = useUpdateUsername();
  const [username, setUsername] = useState(user?.username ?? '');

  const isDirty = username !== user?.username && username.trim().length > 0;

  const handleSave = () => {
    if (!isDirty) return;
    updateUsernameMutation.mutate(
      { username },
      {
        onSuccess: () => {
          success('Username updated');
        },
        onError: (err: any) => {
          toastError(err.response?.data?.message || 'Failed to update username');
        },
      }
    );
  };

  if (!user) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">Profile</h2>
      </div>
      <div className="border-b border-border mb-6" />

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar username={user.username ?? user.email} size="lg" className="w-20 h-20 text-2xl" />
          <div>
            <p className="text-sm font-medium text-text-2">Email</p>
            <p className="text-base text-text">{user.email}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-2">Username</label>
          <div className="flex gap-2">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="flex-1"
            />
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={!isDirty}
              loading={updateUsernameMutation.isPending}
            >
              Save
            </Button>
          </div>
        </div>

        <div className="pt-2">
          <p className="text-sm text-text-3">Account created {formatDate(user.created_at)}</p>
        </div>
      </div>
    </section>
  );
}
