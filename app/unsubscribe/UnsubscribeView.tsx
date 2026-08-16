'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BellOff, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md rounded-[1.75rem] border border-border bg-white p-6 shadow-[0_24px_70px_rgba(0,53,128,0.10)] sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/coat_of_arms.jpeg"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
          />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-success">
              Government of Sierra Leone
            </p>
            <p className="text-sm font-bold text-primary">Smart Meeting</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Turning off the Monday summary.
 *
 * A confirmation step rather than unsubscribing on page load: mail clients
 * pre-fetch links, and a bare GET that changed something would silence people
 * who never clicked. The one-click header posts directly to the API and does
 * not come through here.
 */
export function UnsubscribeView() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';

  const [done, setDone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!email || !token) {
    return (
      <Shell>
        <h1 className="text-lg font-bold text-primary">
          This link is incomplete
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Open it again from the bottom of the summary email, or copy the whole
          address including everything after the question mark.
        </p>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-success">
          <Check className="h-5 w-5" />
          <h1 className="text-lg font-bold">Unsubscribed</h1>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">{email}</span> will no
          longer receive the Monday summary of open action items.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Meeting invitations, reminders, published minutes and anything
          assigned to you are unaffected — those are part of the service and
          tell you about things you are expected at.
        </p>
        <Link
          href="/administrative/login"
          className="mt-5 inline-block text-sm font-medium text-primary underline underline-offset-2"
        >
          Return to Smart Meeting
        </Link>
      </Shell>
    );
  }

  const unsubscribe = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch('/api/v1/unsubscribe/digest', {
        method: 'POST',
        body: JSON.stringify({ email, token }),
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'That did not work. Try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Shell>
      <div className="flex items-center gap-2 text-primary">
        <BellOff className="h-5 w-5" />
        <h1 className="text-lg font-bold">Stop the Monday summary?</h1>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        <span className="font-medium text-slate-900">{email}</span> will stop
        receiving the weekly list of open action items.
      </p>
      <p className="mt-3 text-sm text-slate-600">
        You will still receive meeting invitations, reminders, published minutes
        and anything assigned to you. Those are part of the service.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        onClick={unsubscribe}
        disabled={isSaving}
        className="mt-5 w-full rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSaving ? 'Saving…' : 'Unsubscribe'}
      </button>
    </Shell>
  );
}
