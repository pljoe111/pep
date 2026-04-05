import React, { useState } from 'react';
import type { LabDto, TestDto } from 'api-client';
import {
  useLabs,
  useTests,
  useLabDetail,
  useDeleteLab,
  useDisableTest,
  useEnableTest,
  useDeleteTest,
  useAddLabTest,
} from '../../../api/hooks/useLabs';
import { useToast } from '../../../hooks/useToast';
import { Spinner } from '../../../components/ui/Spinner';
import { AdminSectionHeader } from '../components/shared/AdminSectionHeader';
import { LabList } from '../components/labs/LabList';
import { LabModal } from '../components/labs/LabModal';
import { DeleteLabModal } from '../components/labs/DeleteLabModal';
import { TestCatalog } from '../components/tests/TestCatalog';
import { CreateTestModal } from '../components/tests/CreateTestModal';
import { DisableTestModal } from '../components/tests/DisableTestModal';
import { DeleteTestModal } from '../components/tests/DeleteTestModal';

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

export function LabsTab(): React.ReactElement {
  const [showDisabled, setShowDisabled] = useState(false);
  const [showCreateLab, setShowCreateLab] = useState(false);
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [editLabId, setEditLabId] = useState<string | null>(null);
  const [deleteLabTarget, setDeleteLabTarget] = useState<LabDto | null>(null);
  const [disableTestTarget, setDisableTestTarget] = useState<TestDto | null>(null);
  const [deleteTestTarget, setDeleteTestTarget] = useState<TestDto | null>(null);

  const { data: labsData, isLoading: labsLoading } = useLabs(false, !showDisabled);
  const { data: testsData, isLoading: testsLoading } = useTests(!showDisabled);
  const { data: editLabDetail } = useLabDetail(editLabId ?? '');

  const deleteLabMutation = useDeleteLab();
  const disableTestMutation = useDisableTest();
  const enableTestMutation = useEnableTest();
  const deleteTestMutation = useDeleteTest();
  const addLabTestMutation = useAddLabTest();
  const toast = useToast();

  const labs: LabDto[] = labsData?.data ?? [];
  const tests: TestDto[] = testsData ?? [];

  const handleAddLabTest = async (data: {
    testId: string;
    price: string;
    days: string;
    vials: string;
    endotoxinMode: 'pass_fail' | 'exact_value';
  }): Promise<void> => {
    if (!editLabId) return;
    await addLabTestMutation.mutateAsync(
      {
        labId: editLabId,
        testId: data.testId,
        price_usd: Number(data.price),
        typical_turnaround_days: Number(data.days),
        vials_required: Number(data.vials),
        endotoxin_mode: data.endotoxinMode,
      },
      {
        onSuccess: () => toast.success('Test added to lab'),
        onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to add test to lab')),
      }
    );
  };

  const handleDeleteLab = (): void => {
    if (!deleteLabTarget) return;
    deleteLabMutation.mutate(deleteLabTarget.id, {
      onSuccess: () => {
        toast.success(`${deleteLabTarget.name} deleted`);
        setDeleteLabTarget(null);
      },
      onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to delete lab')),
    });
  };

  const handleDisableTest = (): void => {
    if (!disableTestTarget) return;
    disableTestMutation.mutate(disableTestTarget.id, {
      onSuccess: () => {
        toast.success(`${disableTestTarget.name} disabled`);
        setDisableTestTarget(null);
      },
      onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to disable test')),
    });
  };

  const handleEnableTest = (test: TestDto): void => {
    enableTestMutation.mutate(test.id, {
      onSuccess: () => toast.success(`${test.name} enabled`),
      onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to enable test')),
    });
  };

  const handleDeleteTest = (): void => {
    if (!deleteTestTarget) return;
    deleteTestMutation.mutate(deleteTestTarget.id, {
      onSuccess: () => {
        toast.success(`${deleteTestTarget.name} deleted`);
        setDeleteTestTarget(null);
      },
      onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to delete test')),
    });
  };

  if (labsLoading || testsLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCreateLab(true)}
            className="px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium min-h-[44px]"
          >
            Add Lab
          </button>
          <button
            type="button"
            onClick={() => setShowCreateTest(true)}
            className="px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium min-h-[44px]"
          >
            Add Test
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowDisabled(!showDisabled)}
          className={[
            'px-3 py-2 rounded-full border text-sm font-medium min-h-[36px]',
            showDisabled
              ? 'bg-primary-l border-primary text-primary'
              : 'border-border text-text-2 hover:border-text-3',
          ].join(' ')}
        >
          Show Disabled
        </button>
      </div>

      <AdminSectionHeader title="Labs" />
      <LabList
        labs={labs}
        onEdit={(id) => setEditLabId(id)}
        onDelete={(lab) => setDeleteLabTarget(lab)}
      />

      <hr className="border-border my-4" />

      <TestCatalog
        tests={tests}
        onDisable={(t) => setDisableTestTarget(t)}
        onDelete={(t) => {
          if (t.is_active) {
            handleEnableTest(t);
          } else {
            setDeleteTestTarget(t);
          }
        }}
      />

      {showCreateLab && (
        <LabModal
          mode="create"
          allTests={tests}
          onClose={() => setShowCreateLab(false)}
          onSaved={() => {}}
        />
      )}

      {showCreateTest && (
        <CreateTestModal onClose={() => setShowCreateTest(false)} onCreated={() => {}} />
      )}

      {editLabId && editLabDetail && (
        <LabModal
          mode="edit"
          lab={editLabDetail}
          allTests={tests}
          onClose={() => setEditLabId(null)}
          onSaved={() => {}}
          onAddTest={handleAddLabTest}
        />
      )}

      {deleteLabTarget && (
        <DeleteLabModal
          labName={deleteLabTarget.name}
          onConfirm={handleDeleteLab}
          onClose={() => setDeleteLabTarget(null)}
          isPending={deleteLabMutation.isPending}
        />
      )}

      {disableTestTarget && (
        <DisableTestModal
          test={disableTestTarget}
          onClose={() => setDisableTestTarget(null)}
          onConfirm={handleDisableTest}
          isPending={disableTestMutation.isPending}
        />
      )}

      {deleteTestTarget && (
        <DeleteTestModal
          test={deleteTestTarget}
          onClose={() => setDeleteTestTarget(null)}
          onConfirm={handleDeleteTest}
          isPending={deleteTestMutation.isPending}
        />
      )}
    </div>
  );
}
