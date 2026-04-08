import React from 'react';
import type { CampaignSummaryDto } from 'api-client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useDeleteCampaign } from '../../../api/hooks/useCampaigns';
import { useToast } from '../../../hooks/useToast';

interface DeleteCampaignConfirmProps {
  campaign: CampaignSummaryDto | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteCampaignConfirm({ campaign, isOpen, onClose }: DeleteCampaignConfirmProps) {
  const { toast } = useToast();
  const deleteMutation = useDeleteCampaign();

  const handleDelete = () => {
    if (!campaign) return;
    deleteMutation.mutate(campaign.id, {
      onSuccess: () => {
        toast({ title: 'Campaign deleted', variant: 'success' });
        onClose();
      },
      onError: (error: any) => {
        toast({
          title: 'Delete failed',
          message: error.response?.data?.message || 'An error occurred',
          variant: 'danger',
        });
      },
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Delete "${campaign?.title}"?`} size="sm">
      <div className="space-y-6">
        <p className="text-text-2">
          This cannot be undone. Only campaigns with zero contributions can be deleted.
        </p>

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            fullWidth
            loading={deleteMutation.isPending}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}
