import React from 'react';
import type { TestDto } from 'api-client';
import { AdminSectionHeader } from '../shared/AdminSectionHeader';
import { AdminEmptyState } from '../shared/AdminEmptyState';
import { TestCatalogRow } from './TestCatalogRow';

interface TestCatalogProps {
  tests: TestDto[];
  onDisable: (t: TestDto) => void;
  onDelete: (t: TestDto) => void;
}

export function TestCatalog({ tests, onDisable, onDelete }: TestCatalogProps): React.ReactElement {
  if (tests.length === 0) {
    return <AdminEmptyState message="No tests found" />;
  }

  return (
    <div>
      <AdminSectionHeader title="Test Catalog" />
      <div className="divide-y divide-border">
        {tests.map((t) => (
          <TestCatalogRow key={t.id} test={t} onDisable={onDisable} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
