'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';

const field =
  'mt-1 w-full rounded-xl border border-[#d3deef] bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#003580] focus:outline-none focus:ring-2 focus:ring-[#d7e5fb]';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f8fbff] p-4">
      <div className="w-full max-w-md rounded-[1.75rem] border border-[#d3deef] bg-white p-6 shadow-[0_24px_70px_rgba(0,53,128,0.10)] sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/coat_of_arms.jpeg"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
          />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#007236]">
              Government of Sierra Leone
            </p>
            <p className="text-sm font-bold text-[#003580]">Smart Meeting</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ResetPasswordView() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(false);

  const { data: account, isLoading, error: tokenError } = useQuery({
    queryKey: ['reset-token', token],
    queryFn: () =>
      apiFetch<{ email: string; name: string }>(
        `/api/v1/auth/reset-password/${encodeURIComponent(token)}`,
      ),
    enabled: !!token,
    retry: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch(
        `/api/v1/auth/reset-password/${encodeURIComponent(token)}`,
        { method: 'POST', body: JSON.stringify({ password }) },
      );
      setDone(true);
      setTimeout(() => router.push('/administrative/login'), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not reset your password.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  // One message for missing, expired, used and tampered tokens, matching the
  // server — which of those it was is not something to disclose.
  if (!token || tokenError) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-[#003580]">Link not valid</h1>
        <p className="mt-2 text-sm text-slate-600">
          This reset link is invalid, has expired, or has already been used.
          Reset links last one hour — request a new one to try again.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block rounded-xl bg-[#003580] px-5 py-2.5 text-sm font-medium text-white"
        >
          Request a new link
        </Link>
      </Shell>
    );
  }

  if (isLoading) {
    return (
      <Shell>
        <p className="text-sm text-slate-500">Checking your link…</p>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[#007236]" />
          <h1 className="mt-3 text-xl font-bold text-[#003580]">
            Password changed
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            You have been signed out everywhere else. Taking you to the sign-in
            page…
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-[#003580]" />
        <h1 className="text-lg font-bold text-[#003580]">
          Choose a new password
        </h1>
      </div>
      {account && (
        <p className="text-sm text-slate-600">
          For <span className="break-all font-medium">{account.email}</span>
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isSaving}
            className={field}
          />
          <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            disabled={isSaving}
            className={field}
          />
        </div>

        <button
          type="submit"
          disabled={isSaving || !password || !confirm}
          className="w-full rounded-xl bg-[#003580] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Change password'}
        </button>
      </form>

      <p className="mt-4 text-xs text-slate-500">
        Changing your password signs you out of every other device.
      </p>
    </Shell>
  );
}
