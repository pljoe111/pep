import React, { useState } from 'react';
import type { TestDto } from 'api-client';
import { AdminStatusBadge } from '../shared/AdminStatusBadge';
import { AdminActionButton } from '../shared/AdminActionButton';
import { useTestClaimTemplates } from '../../../../api/hooks/useLabs';
import { TestClaimTemplateList } from './TestClaimTemplateList';
import { Spinner } from '../../../../components/ui/Spinner';

interface TestCatalogRowProps {
  test: TestDto;
  onDisable: (t: TestDto) => void;
  onDelete: (t: TestDto) => void;
}

export function TestCatalogRow({
  test,
  onDisable,
  onDelete,
}: TestCatalogRowProps): React.ReactElement {
  const [showTemplates, setShowTemplates] = useState(false);
  const { data: templates, isLoading } = useTestClaimTemplates(showTemplates ? test.id : '');

  return (
    <div className={`px-0 py-3 border-b border-border ${!test.is_active ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-bold text-text">{test.name}</p>
          {test.description && (
            <p className="text-xs text-text-2 mt-0.5 line-clamp-1">{test.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <AdminStatusBadge status={test.is_active ? 'active' : 'disabled'} />
          <div className="flex flex-wrap gap-1.5">
            {test.is_active ? (
              <AdminActionButton variant="ghost" onClick={() => onDisable(test)}>
                Disable
              </AdminActionButton>
            ) : (
              <>
                <AdminActionButton variant="ghost" onClick={() => onDelete(test)}>
                  Delete
                </AdminActionButton>
              </>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowTemplates(!showTemplates)}
        className="text-xs text-primary font-medium mt-2 min-h-[36px]"
      >
        {showTemplates ? '▼' : '▶'} Claim Templates ({test.claim_templates?.length ?? 0})
      </button>
      {showTemplates && (
        <div className="mt-2">
          {isLoading ? (
            <Spinner size="sm" />
          ) : templates && templates.length > 0 ? (
            <TestClaimTemplateList testId={test.id} templates={templates} onChanged={() => {}} />
          ) : (
            <p className="text-xs text-text-3">No claim templates</p>
          )}
        </div>
      )}
    </div>
  );
}
