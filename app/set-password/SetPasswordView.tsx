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

export function SetPasswordView() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(false);

  const { data: invite, isLoading, error: tokenError } = useQuery({
    queryKey: ['invite', token],
    queryFn: () =>
      apiFetch<{ email: string; name: string }>(
        `/api/v1/invites/${encodeURIComponent(token)}`,
      ),
    enabled: !!token,
    retry: false,
  });

  const handleSubmit = async () => {
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
      await apiFetch(`/api/v1/invites/${encodeURIComponent(token)}/password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setDone(true);
      setTimeout(() => router.push('/administrative/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set your password.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!token || tokenError) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-[#003580]">Invitation not valid</h1>
        <p className="mt-2 text-sm text-slate-600">
          This invitation link is invalid, has expired, or has already been used.
          Ask your ministry administrator to send a new one.
        </p>
        <Link
          href="/administrative/login"
          className="mt-6 inline-block rounded-xl bg-[#003580] px-5 py-2.5 text-sm font-medium text-white"
        >
          Go to sign in
        </Link>
      </Shell>
    );
  }

  if (isLoading) {
    return (
      <Shell>
        <p className="text-sm text-slate-500">Checking your invitation…</p>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[#007236]" />
          <h1 className="mt-3 text-xl font-bold text-[#003580]">Password set</h1>
          <p className="mt-2 text-sm text-slate-600">
            Taking you to the sign-in page…
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold text-[#003580]">Set your password</h1>
      <p className="mt-2 text-sm text-slate-600">
        Welcome{invite?.name ? `, ${invite.name}` : ''}. Choose a password for{' '}
        {/* break-all: an address has no break opportunity, and this card is a
            flex item, so an unbreakable string grows the card past the
            viewport rather than just overflowing it. */}
        <span className="break-all font-medium text-slate-900">
          {invite?.email}
        </span>
        .
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className={field}
          />
          <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoComplete="new-password"
            className={field}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#003580] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <KeyRound className="h-4 w-4" />
          {isSaving ? 'Saving…' : 'Set password and continue'}
        </button>
      </div>
    </Shell>
  );
}
