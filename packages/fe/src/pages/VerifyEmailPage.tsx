import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { UserDto } from 'api-client';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';

type Status = 'verifying' | 'success' | 'error';

interface AuthResponseDto {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
}

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
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (res.ok) {
          const data = (await res.json()) as AuthResponseDto;
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          setUser(data.user);
          setStatus('success');
          setTimeout(() => navigate('/', { replace: true }), 2000);
        } else {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          setErrorMessage(body.message ?? 'Invalid or expired verification link.');
          setStatus('error');
        }
      } catch {
        setErrorMessage('Network error. Please try again.');
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
