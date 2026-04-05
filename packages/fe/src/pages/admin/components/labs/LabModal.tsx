import React, { useState, type ChangeEvent } from 'react';
import type { LabDetailDto, TestDto } from 'api-client';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { useToast } from '../../../../hooks/useToast';
import { labsApi } from '../../../../api/apiClient';
import { LabTestTable, type PendingLabTest } from './LabTestTable';

interface LabModalProps {
  mode: 'create' | 'edit';
  lab?: LabDetailDto;
  allTests: TestDto[];
  onClose: () => void;
  onSaved?: () => void;
  onAddTest?: (data: {
    testId: string;
    price: string;
    days: string;
    vials: string;
    endotoxinMode: 'pass_fail' | 'exact_value';
  }) => Promise<void>;
}

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

export function LabModal({
  mode,
  lab,
  allTests,
  onClose,
  onSaved,
  onAddTest,
}: LabModalProps): React.ReactElement {
  const [name, setName] = useState(lab?.name ?? '');
  const [country, setCountry] = useState(lab?.country ?? '');
  const [phone, setPhone] = useState(lab?.phone_number ?? '');
  const [address, setAddress] = useState(lab?.address ?? '');
  const [pendingTests, setPendingTests] = useState<PendingLabTest[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleAddPending = (t: PendingLabTest): void => {
    setPendingTests((prev) => [...prev, t]);
  };

  const handleRemovePending = (idx: number): void => {
    setPendingTests((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddTest = async (data: {
    testId: string;
    price: string;
    days: string;
    vials: string;
    endotoxinMode: 'pass_fail' | 'exact_value';
  }): Promise<void> => {
    if (onAddTest) {
      await onAddTest(data);
      return;
    }

    if (!lab) return;
    try {
      await labsApi.addTest(lab.id, {
        test_id: data.testId,
        price_usd: Number(data.price),
        typical_turnaround_days: Number(data.days),
        vials_required: Number(data.vials),
        endotoxin_mode: data.endotoxinMode,
      });
      toast.success('Test added to lab');
      onSaved?.();
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Failed to add test to lab'));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!country.trim()) newErrors.country = 'Country is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validate()) return;

    const hasInvalidVials = pendingTests.some((t) => t.vials === '' || Number(t.vials) < 1);
    if (hasInvalidVials) {
      toast.error('All tests require at least 1 vial');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'create') {
        const created = await labsApi.create({
          name: name.trim(),
          country: country.trim(),
          phone_number: phone.trim() || undefined,
          address: address.trim() || undefined,
        });
        for (const pt of pendingTests) {
          await labsApi.addTest(created.data.id, {
            test_id: pt.testId,
            price_usd: Number(pt.price),
            typical_turnaround_days: Number(pt.days),
            vials_required: Number(pt.vials),
            endotoxin_mode: pt.endotoxinMode,
          });
        }
        toast.success('Lab created');
      } else if (lab) {
        await labsApi.update(lab.id, {
          name: name.trim(),
          country: country.trim(),
          phone_number: phone.trim() || undefined,
          address: address.trim() || undefined,
        });
        toast.success('Lab updated');
      }
      onSaved?.();
      onClose();
    } catch (e: unknown) {
      toast.error(
        extractApiError(e, mode === 'create' ? 'Failed to create lab' : 'Failed to update lab')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={mode === 'create' ? 'Add Lab' : `Edit Lab: ${lab?.name}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <Input
            label="Name"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: '' }));
            }}
            error={errors.name}
            required
          />
          <Input
            label="Country"
            value={country}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setCountry(e.target.value);
              setErrors((prev) => ({ ...prev, country: '' }));
            }}
            error={errors.country}
            required
          />
          <Input
            label="Phone"
            value={phone}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
          />
          <Input
            label="Address"
            value={address}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
          />
        </div>

        <div>
          <h4 className="text-sm font-semibold text-text mb-2">Tests</h4>
          <LabTestTable
            mode={mode}
            labId={lab?.id}
            labTests={lab?.tests}
            pendingTests={pendingTests}
            allTests={allTests}
            onAddPending={handleAddPending}
            onRemovePending={handleRemovePending}
            onAddTest={handleAddTest}
            onLabTestSaved={onSaved}
          />
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            loading={loading}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
