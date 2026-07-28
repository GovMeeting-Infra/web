'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, CalendarCheck2, LockKeyhole } from 'lucide-react';
import { SierraLeoneFlag } from '@/components/SierraLeoneFlag';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

type LoginFormData = z.infer<typeof loginSchema>;

const DEFAULT_DESTINATION = '/administrative/dashboard';

/**
 * Where to land after signing in, honouring ?callbackUrl= so a scanned check-in
 * code returns to the check-in page instead of the dashboard.
 *
 * Only same-site absolute paths are accepted. A value starting with `//` (or
 * any scheme) would be an open redirect: the browser reads `//evil.test` as a
 * protocol-relative URL to another host.
 */
function safeDestination(raw: string | null): string {
  if (!raw) return DEFAULT_DESTINATION;
  if (!raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_DESTINATION;
  return raw;
}

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
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
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

      // Read at submit time rather than with useSearchParams, which would
      // require wrapping this client page in a Suspense boundary.
      const callbackUrl = new URLSearchParams(window.location.search).get(
        'callbackUrl',
      );
      router.push(safeDestination(callbackUrl));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // A centred card again, but a substantially larger one — wider than the
    // old max-w-6xl and with a real minimum height, so it fills most of the
    // screen instead of floating small in the middle.
    //
    // h-screen with its own scroll rather than min-h-screen: the root layout
    // pins <body> to h-screen, so a taller child would overflow a container
    // that cannot grow. my-auto on the card centres it while still allowing
    // that scroll — items-center would clip the top on a short window.
    <main className="flex h-screen justify-center overflow-y-auto p-4 sm:p-6 lg:p-8">
      {/* 2fr/3fr is exactly 40/60 — the branded panel takes the smaller share
          so the sign-in content gets the majority of the card. */}
      <section className="my-auto grid w-full max-w-[88rem] grid-cols-1 overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_90px_rgba(0,53,128,0.14)] md:min-h-[44rem] md:grid-cols-[2fr_3fr]">
        {/* Left Hero Panel */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,#003580_0%,#0a4aa0_58%,#007236_100%)] p-12 md:flex lg:p-16">
          {/* Decorative circles */}
          <div className="absolute top-20 right-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />

          <div className="relative z-10 space-y-8">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <Image
                  src="/coat_of_arms.jpeg"
                  alt="Sierra Leone coat of arms"
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain"
                />
                <SierraLeoneFlag className="h-10 w-16" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                  Government of Sierra Leone
                </p>
              </div>
            </div>

            {/* Branding */}
            <div className="space-y-3">
              {/* text-balance evens the line lengths. Without it the title broke
                  after the ampersand and left a wide gap mid-heading. The
                  non-breaking space keeps "& Attendance" from starting a line
                  with a stranded ampersand. */}
              <h1 className="text-balance text-5xl font-bold leading-[1.1] tracking-tight text-white lg:text-6xl">
                Smart Meeting&nbsp;&amp; Attendance Logger
              </h1>
              <p className="text-balance text-lg text-white/90 lg:text-xl">
                Streamline government meetings with secure check-in and real-time attendance tracking
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="relative z-10 space-y-6 border-t border-white/20 pt-8">
            <Feature
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Secure Access"
              description="Government-only email domain with role-based permissions"
            />
            <Feature
              icon={<CalendarCheck2 className="h-6 w-6" />}
              title="QR Check-In"
              description="Fast, contactless attendance verification with rotating tokens"
            />
            <Feature
              icon={<LockKeyhole className="h-6 w-6" />}
              title="Complete Audit Trail"
              description="Every action logged for compliance and accountability"
            />
          </div>
        </aside>

        {/* Right Form Panel */}
        {/* The form column fills its half but the fields stay a readable width,
            rather than stretching across a wide monitor. */}
        <div className="flex flex-col justify-center bg-white px-6 py-12 sm:px-10 md:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-md">
          {/* Mobile header (hidden on desktop) */}
          <div className="mb-8 text-center md:hidden">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Image
                src="/coat_of_arms.jpeg"
                alt="Sierra Leone coat of arms"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
              <SierraLeoneFlag className="h-8 w-12" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/80 mb-2">
              Government of Sierra Leone
            </p>
          </div>

          <div className="space-y-8">
            {/* Form Header */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
                Administrative Portal
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Sign in to continue
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter your government email and password to access your account
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    inputMode="email"
                    placeholder="your.email@gov.sl"
                    className="w-full rounded-2xl border border-border bg-input px-4 py-3 pl-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    {...register('email')}
                    required
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register('password')}
                  required
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-2xl bg-primary px-4 py-3 font-medium text-primary-foreground shadow-[0_16px_32px_rgba(0,53,128,0.18)] transition-all hover:shadow-[0_20px_40px_rgba(0,53,128,0.24)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>

              <p className="text-center text-sm">
                <Link
                  href="/forgot-password"
                  className="font-medium text-primary hover:underline"
                >
                  Forgotten your password?
                </Link>
              </p>
            </form>

            {/* Footer */}
            <div className="space-y-4 border-t border-border pt-6">
              <div className="text-center">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  ← Return to the public calendar
                </Link>
              </div>
              <p className="text-center text-xs text-muted-foreground leading-relaxed">
                This portal is restricted to government officials only. Unauthorized access is prohibited by law. All activity is monitored and logged for security purposes.
              </p>
            </div>
          </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/10 text-white">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/75">{description}</p>
      </div>
    </div>
  );
}
