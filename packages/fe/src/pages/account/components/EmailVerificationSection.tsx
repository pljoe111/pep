import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useResendVerificationEmail } from '../../../api/hooks/useUser';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';

export function EmailVerificationSection() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const resendMutation = useResendVerificationEmail();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: number | undefined;
    if (cooldown > 0) {
      timer = window.setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [cooldown]);

  if (!user || user.email_verified) return null;

  const handleResend = () => {
    if (cooldown > 0) return;
    resendMutation.mutate(undefined, {
      onSuccess: () => {
        success('Verification email sent');
        setCooldown(60);
      },
      onError: (err: unknown) => {
        const apiErr = err as { response?: { status?: number; data?: { message?: string } } };
        if (apiErr.response?.status === 429) {
          toastError('Please wait before requesting another email.');
        } else {
          toastError(apiErr.response?.data?.message ?? 'Failed to resend email');
        }
      },
    });
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
      <div className="flex gap-3 mb-3">
        <AlertTriangle className="text-amber-600 shrink-0" size={20} />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-amber-900">Email Verification Required</h3>
          <p className="text-sm text-amber-800 leading-relaxed">
            Your email is not verified. You must verify your email to contribute to campaigns.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-amber-700">
          Verification email sent to: <span className="font-semibold">{user.email}</span>
        </p>

        <Button
          variant="secondary"
          size="md"
          fullWidth
          onClick={handleResend}
          disabled={cooldown > 0}
          loading={resendMutation.isPending}
          className="bg-white border-amber-200 text-amber-800 hover:bg-amber-100"
          icon={cooldown > 0 ? <CheckCircle2 size={16} /> : undefined}
        >
          {cooldown > 0 ? `Email sent ✓ (${cooldown}s)` : 'Resend verification email'}
        </Button>

        <p className="text-[10px] text-amber-600 text-center">
          After verifying, refresh the page to update your status.
        </p>
      </div>
    </div>
  );
}
