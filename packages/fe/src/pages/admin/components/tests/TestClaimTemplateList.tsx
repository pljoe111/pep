import React, { useState } from 'react';
import type { TestClaimTemplateDto } from 'api-client';
import { TestClaimTemplateRow } from './TestClaimTemplateRow';

interface TestClaimTemplateListProps {
  testId: string;
  templates: TestClaimTemplateDto[];
  onChanged: () => void;
}

export function TestClaimTemplateList({
  testId,
  templates,
  onChanged,
}: TestClaimTemplateListProps): React.ReactElement {
  const [showNewRow, setShowNewRow] = useState(false);

  return (
    <div className="mt-2">
      {templates.map((t) => (
        <TestClaimTemplateRow
          key={t.id}
          template={t}
          testId={testId}
          onSaved={onChanged}
          onRemove={onChanged}
        />
      ))}
      {showNewRow && (
        <TestClaimTemplateRow
          testId={testId}
          onSaved={() => {
            setShowNewRow(false);
            onChanged();
          }}
          onRemove={() => setShowNewRow(false)}
        />
      )}
      <button
        type="button"
        onClick={() => setShowNewRow(true)}
        className="text-primary text-xs font-medium mt-2 min-h-[36px]"
      >
        + Add Claim Template
      </button>
    </div>
  );
}
