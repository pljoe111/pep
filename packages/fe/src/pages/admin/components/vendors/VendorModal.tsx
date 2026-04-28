import React, { useState, type ChangeEvent } from 'react';
import type { VendorDto } from 'api-client';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Textarea } from '../../../../components/ui/Textarea';
import { useToast } from '../../../../hooks/useToast';
import { vendorsApi } from '../../../../api/apiClient';

interface VendorModalProps {
  mode: 'create' | 'edit';
  vendor?: VendorDto;
  onClose: () => void;
  onSaved?: () => void;
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

export function VendorModal({
  mode,
  vendor,
  onClose,
  onSaved,
}: VendorModalProps): React.ReactElement {
  const [name, setName] = useState(vendor?.name ?? '');
  const [website, setWebsite] = useState(vendor?.website ?? '');
  const [country, setCountry] = useState(vendor?.country ?? '');
  const [telegram, setTelegram] = useState(vendor?.telegram_group ?? '');
  const [contactNotes, setContactNotes] = useState(vendor?.contact_notes ?? '');
  const [status, setStatus] = useState<'approved' | 'pending' | 'rejected'>(
    vendor?.status ?? 'pending'
  );
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (): Promise<void> => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'create') {
        await vendorsApi.createVendor({
          name: name.trim(),
          website: website.trim() || undefined,
          country: country.trim() || undefined,
          telegram_group: telegram.trim() || undefined,
          contact_notes: contactNotes.trim() || undefined,
        });
        toast.success('Vendor created');
      } else if (vendor) {
        await vendorsApi.updateVendor(vendor.id, {
          name: name.trim(),
          website: website.trim() || undefined,
          country: country.trim() || undefined,
          telegram_group: telegram.trim() || undefined,
          contact_notes: contactNotes.trim() || undefined,
          status,
        });
        toast.success('Vendor updated');
      }
      onSaved?.();
      onClose();
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Failed to save vendor'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={mode === 'create' ? 'Add Vendor' : `Edit Vendor: ${vendor?.name}`}
      size="md"
    >
      <div className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          required
        />
        <Input
          label="Website"
          value={website}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setWebsite(e.target.value)}
        />
        <Input
          label="Country"
          value={country}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)}
        />
        <Input
          label="Telegram Group"
          value={telegram}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setTelegram(e.target.value)}
        />
        <Textarea
          label="Contact Notes"
          value={contactNotes}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContactNotes(e.target.value)}
          rows={3}
        />
        {mode === 'edit' && (
          <div>
            <label className="text-sm font-medium text-text block mb-1">Status</label>
            <select
              value={status}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setStatus(e.target.value as 'approved' | 'pending' | 'rejected')
              }
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
            >
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        )}
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
