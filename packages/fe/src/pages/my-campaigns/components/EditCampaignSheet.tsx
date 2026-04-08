import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Lock } from 'lucide-react';
import type { CampaignSummaryDto, UpdateCampaignDto } from 'api-client';
import { Sheet } from '../../../components/ui/Sheet';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { useUpdateCampaign } from '../../../api/hooks/useCampaigns';
import { useToast } from '../../../hooks/useToast';

interface EditCampaignSheetProps {
  campaign: CampaignSummaryDto | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditCampaignSheet({ campaign, isOpen, onClose }: EditCampaignSheetProps) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isDirty, errors },
  } = useForm<UpdateCampaignDto>({
    defaultValues: {
      title: campaign?.title ?? '',
      description: campaign?.description ?? '',
    },
  });

  const updateMutation = useUpdateCampaign(campaign?.id ?? '');

  useEffect(() => {
    if (campaign) {
      reset({
        title: campaign.title,
        description: campaign.description,
      });
    }
  }, [campaign, reset]);

  const watchTitle = watch('title', '');

  const onSubmit = (data: UpdateCampaignDto) => {
    updateMutation.mutate(data, {
      onSuccess: () => {
        toast({ title: 'Campaign updated', variant: 'success' });
        onClose();
      },
      onError: (error: any) => {
        toast({
          title: 'Update failed',
          message: error.response?.data?.message || 'An error occurred',
          variant: 'danger',
        });
      },
    });
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Edit Campaign">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1">
          <div className="flex justify-between items-end">
            <label className="text-sm font-medium text-text">Title</label>
            <span className="text-xs text-text-3">{watchTitle.length}/200</span>
          </div>
          <Input
            {...register('title', {
              required: 'Title is required',
              maxLength: { value: 200, message: 'Title too long' },
            })}
            placeholder="Campaign title"
            error={errors.title?.message}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-text">Description</label>
          <Textarea
            {...register('description', { required: 'Description is required' })}
            placeholder="Describe your campaign..."
            rows={5}
            error={errors.description?.message}
          />
        </div>

        <div className="flex items-start gap-2 p-3 bg-surface-a rounded-xl border border-border">
          <Lock size={14} className="text-text-3 mt-0.5 shrink-0" />
          <p className="text-xs text-text-3 leading-relaxed">
            Samples and tests are locked to protect existing contributors.
          </p>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          size="lg"
          loading={updateMutation.isPending}
          disabled={!isDirty}
        >
          Save Changes
        </Button>
      </form>
    </Sheet>
  );
}
