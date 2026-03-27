import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/apiClient';

export function AccountPage(): React.ReactElement {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  if (!isAuthenticated || !user) {
    void navigate('/login');
    return <div />;
  }

  const handleLogout = async (): Promise<void> => {
    await logout();
    void navigate('/');
  };

  const handleResendVerification = async (): Promise<void> => {
    try {
      await authApi.resendVerification();
      toast.success('Verification email sent — check your inbox');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    }
  };

  return (
    <AppShell>
      <PageContainer className="py-4">
        <h1 className="text-2xl font-bold text-text mb-6">Account</h1>

        {/* Profile card */}
        <Card padding="lg" className="mb-4">
          <div className="flex items-center gap-4 mb-4">
            <Avatar username={user.username ?? user.email.split('@')[0]} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg text-text">{user.username ?? 'No username'}</p>
              <p className="text-sm text-text-2 break-all">{user.email}</p>
            </div>
          </div>

          {/* Email verification */}
          {!user.email_verified ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-sm text-warning font-medium mb-2">Email not verified</p>
              <Button variant="secondary" size="sm" onClick={() => void handleResendVerification()}>
                Resend Verification Email
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="green">Email Verified</Badge>
            </div>
          )}

          {/* Claims */}
          {user.claims.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-text-2 font-medium mb-1">Permissions</p>
              <div className="flex flex-wrap gap-1">
                {user.claims.map((claim) => (
                  <Badge key={claim} variant="teal">
                    {claim}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          {user.stats && (
            <div className="grid grid-cols-3 gap-2 text-center pt-4 border-t border-border">
              <div>
                <p className="font-bold text-lg text-text">{user.stats.campaigns_created}</p>
                <p className="text-xs text-text-2">Created</p>
              </div>
              <div>
                <p className="font-bold text-lg text-text">{user.stats.campaigns_successful}</p>
                <p className="text-xs text-text-2">Successful</p>
              </div>
              <div>
                <p className="font-bold text-lg text-primary">
                  ${user.stats.total_contributed_usd.toFixed(0)}
                </p>
                <p className="text-xs text-text-2">Contributed</p>
              </div>
            </div>
          )}
        </Card>

        {/* Admin link */}
        {user.claims.includes('admin') && (
          <Card padding="md" className="mb-4" onClick={() => void navigate('/admin')}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-text">Admin Dashboard</p>
              <svg
                className="w-5 h-5 text-text-3"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </Card>
        )}

        {/* Logout */}
        <Button variant="danger" size="lg" fullWidth onClick={() => void handleLogout()}>
          Sign Out
        </Button>
      </PageContainer>
    </AppShell>
  );
}
