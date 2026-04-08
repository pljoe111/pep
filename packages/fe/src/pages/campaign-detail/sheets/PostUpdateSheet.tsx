import { useForm } from 'react-hook-form';
import { useAddCampaignUpdate } from '../../../api/hooks/useCampaigns';
import { Sheet } from '../../../components/ui/Sheet';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { useToast } from '../../../hooks/useToast';
import { MessageSquare } from 'lucide-react';

interface PostUpdateSheetProps {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface UpdateFormValues {
  content: string;
}

export const PostUpdateSheet = ({ campaignId, isOpen, onClose }: PostUpdateSheetProps) => {
  const { mutate: addUpdate, isPending } = useAddCampaignUpdate(campaignId);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<UpdateFormValues>({
    mode: 'onChange',
    defaultValues: { content: '' },
  });

  const content = watch('content');

  const onSubmit = (values: UpdateFormValues) => {
    addUpdate(
      { content: values.content },
      {
        onSuccess: () => {
          toast.success('Update posted');
          reset();
          onClose();
        },
        onError: (error: any) => {
          toast.error(error?.response?.data?.message || 'Failed to post update');
        },
      }
    );
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Post Update">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-3 uppercase tracking-wide">
            What would you like to share with your backers?
          </label>
          <Textarea
            {...register('content', {
              required: 'Update content is required',
              minLength: { value: 10, message: 'Update must be at least 10 characters' },
              maxLength: { value: 1000, message: 'Update cannot exceed 1000 characters' },
            })}
            placeholder="Share progress, tracking numbers, or lab updates..."
            rows={6}
            error={errors.content?.message}
          />
          <div className="flex justify-end">
            <span className={`text-xs ${content.length > 1000 ? 'text-danger' : 'text-text-3'}`}>
              {content.length}/1000
            </span>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          size="lg"
          disabled={!isValid}
          loading={isPending}
        >
          <MessageSquare className="w-5 h-5" />
          Post Update
        </Button>
      </form>
    </Sheet>
  );
};
