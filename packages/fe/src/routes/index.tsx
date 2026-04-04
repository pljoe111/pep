import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from '../components/ui/Spinner';
import { HomePage } from '../pages/HomePage';
import { CampaignDetailPage } from '../pages/CampaignDetailPage';
import { CreateCampaignPage } from '../pages/CreateCampaignPage';
import { MyCampaignsPage } from '../pages/MyCampaignsPage';
import { WalletPage } from '../pages/WalletPage';
import { AdminPage } from '../pages/AdminPage';
import { LoginPage } from '../pages/LoginPage';
import { AccountPage } from '../pages/AccountPage';
import { OfflinePage } from '../pages/OfflinePage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';

/** Route guard: redirect to /login if not authenticated */
function ProtectedRoute({ children }: { children: React.ReactNode }): React.ReactElement {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/** Route guard: redirect to / if not admin */
function AdminRoute({ children }: { children: React.ReactNode }): React.ReactElement {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !(user?.claims ?? []).includes('admin')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function NotFoundPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-extrabold text-text mb-3">404</h1>
      <p className="text-text-2 mb-6">This page doesn&apos;t exist.</p>
      <a
        href="/"
        className="px-5 py-3 bg-primary text-white rounded-xl font-semibold min-h-[44px] flex items-center"
      >
        Go home
      </a>
    </div>
  );
}

function AppRoutes(): React.ReactElement {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/offline" element={<OfflinePage />} />

      {/* Protected routes */}
      <Route
        path="/create"
        element={
          <ProtectedRoute>
            <CreateCampaignPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <WalletPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-campaigns"
        element={
          <ProtectedRoute>
            <MyCampaignsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        }
      />

      {/* Admin-only routes */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />

      {/* 404 fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
