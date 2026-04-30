import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/apiClient';

type Status = 'verifying' | 'success' | 'error';

export function VerifyEmailPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const calledRef = useRef(false);

  useEffect(() => {
    // Prevent double-fire in React StrictMode
    if (calledRef.current) return;
    calledRef.current = true;

    const token = searchParams.get('token');

    if (!token) {
      setErrorMessage('No verification token found in the link.');
      setStatus('error');
      return;
    }

    void (async () => {
      try {
        const { data } = await authApi.verifyEmail({ token });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        setUser(data.user);
        setStatus('success');
        setTimeout(() => navigate('/', { replace: true }), 2000);
      } catch (err: unknown) {
        const body = (err as { response?: { data?: { message?: string } } }).response?.data;
        setErrorMessage(body?.message ?? 'Invalid or expired verification link.');
        setStatus('error');
      }
    })();
  }, [searchParams, navigate, setUser]);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 text-center">
      {status === 'verifying' && (
        <>
          <Spinner size="lg" />
          <p className="mt-4 text-text-2">Verifying your email…</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-text mb-2">Email verified!</h1>
          <p className="text-text-2">Taking you home…</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-text mb-2">Verification failed</h1>
          <p className="text-text-2 mb-6">{errorMessage}</p>
          <a
            href="/login"
            className="px-5 py-3 bg-primary text-white rounded-xl font-semibold min-h-[44px] flex items-center"
          >
            Go to login
          </a>
        </>
      )}
    </div>
  );
}
