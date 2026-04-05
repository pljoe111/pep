import React from 'react';
import type { LabTestDto, TestDto } from 'api-client';
import { LabTestRow } from './LabTestRow';
import { AddTestToLabForm } from './AddTestToLabForm';

export interface PendingLabTest {
  testId: string;
  testName: string;
  price: string;
  days: string;
  vials: string;
  endotoxinMode: 'pass_fail' | 'exact_value';
}

interface LabTestTableProps {
  mode: 'edit' | 'create';
  labId?: string;
  labTests?: LabTestDto[];
  pendingTests?: PendingLabTest[];
  allTests: TestDto[];
  onLabTestSaved?: () => void;
  onAddPending?: (t: PendingLabTest) => void;
  onRemovePending?: (idx: number) => void;
  onAddTest?: (data: {
    testId: string;
    price: string;
    days: string;
    vials: string;
    endotoxinMode: 'pass_fail' | 'exact_value';
  }) => Promise<void>;
}

export function LabTestTable({
  mode,
  labId,
  labTests,
  pendingTests,
  allTests,
  onLabTestSaved,
  onAddPending,
  onRemovePending,
  onAddTest,
}: LabTestTableProps): React.ReactElement {
  const availableTests =
    mode === 'edit'
      ? allTests.filter((t) => t.is_active && !labTests?.some((lt) => lt.test_id === t.id))
      : allTests.filter((t) => t.is_active);

  return (
    <div className="space-y-4">
      <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-surface">
        {mode === 'edit' &&
          labTests?.map((lt) => (
            <LabTestRow
              key={lt.id}
              labId={labId ?? ''}
              labTest={lt}
              onSaved={() => onLabTestSaved?.()}
              mode="edit"
            />
          ))}
        {mode === 'create' &&
          pendingTests?.map((pt, idx) => (
            <LabTestRow
              key={idx}
              labId=""
              labTest={{
                id: String(idx),
                lab_id: '',
                test_id: pt.testId,
                test_name: pt.testName,
                price_usd: Number(pt.price),
                typical_turnaround_days: Number(pt.days),
                vials_required: Number(pt.vials),
                endotoxin_mode: pt.endotoxinMode,
                is_active: true,
              }}
              onSaved={() => {}}
              mode="create"
              onRemoveFromPending={() => onRemovePending?.(idx)}
            />
          ))}

        <div className="p-4 bg-surface-a/50">
          {mode === 'edit' && (
            <AddTestToLabForm
              availableTests={availableTests}
              onAdd={(data) => {
                if (onAddTest) {
                  void onAddTest(data);
                }
              }}
            />
          )}
          {mode === 'create' && (
            <AddTestToLabForm
              availableTests={availableTests}
              onAdd={(data) => {
                const test = allTests.find((t) => t.id === data.testId);
                onAddPending?.({
                  ...data,
                  testName: test?.name ?? '',
                });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
