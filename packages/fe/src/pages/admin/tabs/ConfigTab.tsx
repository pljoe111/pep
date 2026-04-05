import React from 'react';
import type { ConfigurationDto } from 'api-client';
import { useAdminConfig, useAdminUpdateConfig } from '../../../api/hooks/useAdmin';
import { Spinner } from '../../../components/ui/Spinner';
import { AdminEmptyState } from '../components/shared/AdminEmptyState';
import { ConfigRow } from '../components/config/ConfigRow';

export function ConfigTab(): React.ReactElement {
  const { data, isLoading } = useAdminConfig();
  const updateMutation = useAdminUpdateConfig();

  const configs: ConfigurationDto[] = data ?? [];

  const handleSave = async (key: string, value: unknown): Promise<void> => {
    await updateMutation.mutateAsync({ key, dto: { value } });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (configs.length === 0) {
    return <AdminEmptyState message="No configuration found" />;
  }

  return (
    <div className="space-y-3">
      {configs.map((cfg) => (
        <ConfigRow
          key={cfg.config_key}
          cfg={cfg}
          onSave={(value) => handleSave(cfg.config_key, value)}
          isSaving={updateMutation.isPending}
        />
      ))}
    </div>
  );
}
