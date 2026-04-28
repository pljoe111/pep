import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';

export function ChangePasswordForm() {
  const { error: toastError } = useToast();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPassword = watch('newPassword');

  const onSubmit = (_data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    setIsPending(true);
    try {
      // Password change is not yet implemented in the BFF controllers.
      // This is a placeholder for when the endpoint is added.
      throw new Error('Password change is currently unavailable.');
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">Change Password</h2>
      </div>
      <div className="border-b border-border mb-6" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(onSubmit)(e);
        }}
        className="space-y-4"
      >
        <div className="space-y-1">
          <label className="text-sm font-medium text-text-2">Current Password</label>
          <div className="relative">
            <Input
              type={showCurrent ? 'text' : 'password'}
              {...register('currentPassword', { required: 'Current password is required' })}
              error={errors.currentPassword?.message}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-3 text-text-3 hover:text-text transition-colors"
            >
              {showCurrent ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-text-2">New Password</label>
          <div className="relative">
            <Input
              type={showNew ? 'text' : 'password'}
              {...register('newPassword', {
                required: 'New password is required',
                minLength: { value: 8, message: 'Minimum 8 characters' },
              })}
              error={errors.newPassword?.message}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-3 text-text-3 hover:text-text transition-colors"
            >
              {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-text-2">Confirm New Password</label>
          <div className="relative">
            <Input
              type={showConfirm ? 'text' : 'password'}
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (val) => val === newPassword || 'Passwords do not match',
              })}
              error={errors.confirmPassword?.message}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-3 text-text-3 hover:text-text transition-colors"
            >
              {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            loading={isPending}
            disabled={true} // Disabled until BFF endpoint exists
          >
            Change Password (Coming Soon)
          </Button>
        </div>
      </form>
    </section>
  );
}
