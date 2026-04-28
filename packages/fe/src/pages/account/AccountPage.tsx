import { LogOut } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { PageContainer } from '../../components/layout/PageContainer';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { ProfileSection } from './components/ProfileSection';
import { EmailVerificationSection } from './components/EmailVerificationSection';
import { ChangePasswordForm } from './components/ChangePasswordForm';
import { NotificationPrefsForm } from './components/NotificationPrefsForm';

export default function AccountPage() {
  const { logout } = useAuth();

  return (
    <AppShell>
      <PageContainer>
        <h1 className="text-3xl font-bold text-text mb-6">My Account</h1>

        <ProfileSection />
        <EmailVerificationSection />
        <ChangePasswordForm />
        <NotificationPrefsForm />

        <div className="pt-4 pb-12">
          <Button
            variant="ghost"
            fullWidth
            size="lg"
            onClick={() => {
              void logout();
            }}
            className="text-danger hover:bg-red-50 border-danger/20"
            icon={<LogOut size={18} />}
          >
            Log Out
          </Button>
        </div>
      </PageContainer>
    </AppShell>
  );
}
