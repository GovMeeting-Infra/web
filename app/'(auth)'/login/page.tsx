'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || 'Login failed');
        return;
      }

      router.push('/administrative/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#003580] to-[#007236]">
            <span className="text-3xl font-bold text-white">G</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#003580]">
            SmartMeeting
          </h1>
          <p className="mt-2 text-sm font-medium uppercase tracking-[0.16em] text-[#007236]/80">
            Government of Sierra Leone
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[2rem] border border-[#d3deef] bg-[#fafdff] p-8 shadow-[0_24px_70px_rgba(0,53,128,0.08)]">
          <h2 className="text-2xl font-bold text-[#003580]">Welcome</h2>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to access your government meeting management system
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#11243d]">
                Email Address
              </label>
              <input
                type="email"
                placeholder="your.email@gov.sl"
                className="mt-2 w-full rounded-lg border border-[#d3deef] bg-[#f5f9fe] px-4 py-3 text-sm text-[#11243d] placeholder:text-slate-500 transition-colors focus:border-[#003580] focus:outline-none focus:ring-2 focus:ring-[#003580]/20"
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#11243d]">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="mt-2 w-full rounded-lg border border-[#d3deef] bg-[#f5f9fe] px-4 py-3 text-sm text-[#11243d] placeholder:text-slate-500 transition-colors focus:border-[#003580] focus:outline-none focus:ring-2 focus:ring-[#003580]/20"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#d3deef]"
                />
                <span className="text-sm text-slate-600">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-sm font-medium text-[#003580] hover:text-[#002563]">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-gradient-to-r from-[#003580] to-[#002563] px-4 py-3 font-medium text-white shadow-[0_8px_16px_rgba(0,53,128,0.24)] transition-all hover:shadow-[0_12px_24px_rgba(0,53,128,0.32)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Government officials only.{' '}
            <a href="https://gov.sl" className="font-medium text-[#003580] hover:text-[#002563]">
              Learn more
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
