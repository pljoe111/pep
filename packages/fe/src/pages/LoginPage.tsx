import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/apiClient';

interface LoginForm {
  email: string;
  password: string;
}

interface RegisterForm {
  email: string;
  password: string;
  username: string;
}

function SignInForm({ onSwitch }: { onSwitch: () => void }): React.ReactElement {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>();

  const onSubmit = handleSubmit(async (data) => {
    try {
      await login(data.email, data.password);
      void navigate('/');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    }
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register('email', { required: 'Email is required' })}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register('password', { required: 'Password is required' })}
      />
      <Button type="submit" variant="primary" size="lg" fullWidth loading={isSubmitting}>
        Sign In
      </Button>
      <p className="text-center text-sm text-text-2">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={onSwitch}
          className="text-primary font-medium hover:underline"
        >
          Sign up
        </button>
      </p>
    </form>
  );
}

function SignUpForm({ onSwitch }: { onSwitch: () => void }): React.ReactElement {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>();

  const onSubmit = handleSubmit(async (data) => {
    try {
      await authApi.register({
        email: data.email,
        password: data.password,
        username: data.username || undefined,
      });
      await login(data.email, data.password);
      toast.success('Account created! Check your email to verify.');
      void navigate('/');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Registration failed');
    }
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register('email', { required: 'Email is required' })}
      />
      <Input
        label="Username (optional)"
        autoComplete="username"
        placeholder="e.g. alice_99"
        error={errors.username?.message}
        {...register('username')}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        helperText="Min 8 chars, 1 uppercase, 1 lowercase, 1 digit"
        error={errors.password?.message}
        {...register('password', {
          required: 'Password is required',
          minLength: { value: 8, message: 'Min 8 characters' },
        })}
      />
      <Button type="submit" variant="primary" size="lg" fullWidth loading={isSubmitting}>
        Create Account
      </Button>
      <p className="text-center text-sm text-text-2">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitch}
          className="text-primary font-medium hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}

export function LoginPage(): React.ReactElement {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mb-8">
        <span className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-sm">
          PL
        </span>
        <span className="text-2xl font-bold text-primary">PepLab</span>
      </Link>

      <Card className="w-full max-w-sm" padding="lg">
        <h1 className="text-xl font-bold text-text mb-6">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        {mode === 'login' ? (
          <SignInForm onSwitch={() => setMode('register')} />
        ) : (
          <SignUpForm onSwitch={() => setMode('login')} />
        )}
      </Card>

      <p className="mt-6 text-xs text-text-3 text-center max-w-xs">
        Community-funded peptide &amp; supplement lab testing.
      </p>
    </div>
  );
}
