'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { KeyRound, MailCheck, ArrowLeft } from 'lucide-react';
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError(null);
    try {
      await apiFetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      // Shown whether or not the address exists — the server deliberately
      // does not say, so neither can this page.
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not send a reset link.',
      );
    } finally {
      setIsSending(false);
    }
  };

  if (sent) {
    return (
      <Shell>
        <div className="text-center">
          <MailCheck className="mx-auto h-10 w-10 text-[#007236]" />
          <h1 className="mt-3 text-lg font-bold text-[#003580]">Check your email</h1>
          <p className="mt-2 text-sm text-slate-600">
            If <span className="break-all font-medium">{email.trim()}</span>{' '}
            belongs to an
            account, a reset link is on its way. It expires in one hour and can
            only be used once.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Nothing arrived? Check your spam folder, or ask your ministry
            administrator to help you back in.
          </p>
          <Link
            href="/administrative/login"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#003580] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-[#003580]" />
        <h1 className="text-lg font-bold text-[#003580]">Forgotten password</h1>
      </div>
      <p className="text-sm text-slate-600">
        Enter your government email address and we will send you a link to
        choose a new password.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-5">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isSending}
          placeholder="you@ministry.gov.sl"
          className={field}
        />

        <button
          type="submit"
          disabled={isSending || !email.trim()}
          className="mt-5 w-full rounded-xl bg-[#003580] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <Link
        href="/administrative/login"
        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#003580]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </Shell>
  );
}
