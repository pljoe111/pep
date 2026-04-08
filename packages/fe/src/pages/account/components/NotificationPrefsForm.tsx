import React, { useState, useEffect } from 'react';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../../../api/hooks/useUser';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';
import { useToast } from '../../../hooks/useToast';
import type { NotificationPreferencesDto } from 'api-client';

interface EventGroup {
  id: string;
  label: string;
  key: keyof NotificationPreferencesDto;
}

const EVENT_GROUPS: EventGroup[] = [
  { id: 'funded', label: 'Campaign funded (creator)', key: 'campaign_funded' },
  { id: 'locked', label: 'Campaign locked (contributor)', key: 'campaign_locked' },
  { id: 'shipped', label: 'Samples shipped (contributor)', key: 'samples_shipped' },
  { id: 'coa_uploaded', label: 'COA uploaded (creator)', key: 'coa_uploaded' },
  { id: 'resolved', label: 'Campaign resolved', key: 'campaign_resolved' },
  { id: 'refunded', label: 'Campaign refunded', key: 'campaign_refunded' },
  { id: 'deposit', label: 'Deposit confirmed', key: 'deposit_confirmed' },
  { id: 'withdrawal_sent', label: 'Withdrawal sent', key: 'withdrawal_sent' },
  { id: 'withdrawal_failed', label: 'Withdrawal failed', key: 'withdrawal_failed' },
];

export function NotificationPrefsForm() {
  const { data: initialPrefs, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();
  const { success, error: toastError } = useToast();
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferencesDto | null>(null);

  useEffect(() => {
    if (initialPrefs) {
      setLocalPrefs(initialPrefs);
    }
  }, [initialPrefs]);

  const isDirty = JSON.stringify(localPrefs) !== JSON.stringify(initialPrefs);

  const handleToggle = (key: keyof NotificationPreferencesDto, channel: 'in_app' | 'email') => {
    if (!localPrefs) return;
    const currentChannel = localPrefs[key] || { in_app: false, email: false };
    setLocalPrefs({
      ...localPrefs,
      [key]: {
        ...currentChannel,
        [channel]: !currentChannel[channel],
      },
    });
  };

  const handleSave = () => {
    if (!localPrefs || !isDirty) return;
    updateMutation.mutate(localPrefs, {
      onSuccess: () => {
        success('Notification preferences saved');
      },
      onError: (err: any) => {
        toastError(err.response?.data?.message || 'Failed to save preferences');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!localPrefs) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">Notification Preferences</h2>
      </div>
      <div className="border-b border-border mb-6" />

      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs font-bold text-text-3 uppercase tracking-wider border-b border-border">
              <th className="py-3 pr-4">Event</th>
              <th className="py-3 px-4 text-center">In-app</th>
              <th className="py-3 pl-4 text-center">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {EVENT_GROUPS.map((group) => (
              <tr key={group.id}>
                <td className="py-4 pr-4 text-sm text-text font-medium">{group.label}</td>
                <td className="py-4 px-4 text-center">
                  <Toggle
                    checked={localPrefs[group.key]?.in_app ?? false}
                    onChange={() => handleToggle(group.key, 'in_app')}
                  />
                </td>
                <td className="py-4 pl-4 text-center">
                  <Toggle
                    checked={localPrefs[group.key]?.email ?? false}
                    onChange={() => handleToggle(group.key, 'email')}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <Button
          variant="primary"
          fullWidth
          size="lg"
          onClick={handleSave}
          disabled={!isDirty}
          loading={updateMutation.isPending}
        >
          Save Preferences
        </Button>
      </div>
    </section>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <div
        className={`w-10 h-6 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-stone-200'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ml-0.5 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
    </label>
  );
}
