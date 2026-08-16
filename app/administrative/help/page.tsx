import { Mail, LifeBuoy, UserCog } from 'lucide-react';
import { HelpBrowser } from './HelpBrowser';
import { StartTourButton } from '@/components/tour/StartTourButton';
import { PageContainer } from '@/components/ui/page-container';
import { getSupportEmail } from '@/lib/session';

/**
 * The support address is a platform setting, not a constant.
 *
 * It was hardcoded to support@ministry.gov.sl, which is not a domain any
 * ministry owns — the real ones are moh.gov.sl, med.gov.sl and so on. So the
 * single "ask a human" route on the page, for every ministry, was an address
 * that bounced. When no address is configured the page names the reader's
 * ministry administrator instead, who is a person the system knows exists.
 */
export default async function HelpPage() {
  const supportEmail = await getSupportEmail();

  return (
    <PageContainer>
      <div className="overflow-hidden rounded-[1.75rem] border border-border bg-primary text-primary-foreground">
        <div className="flex flex-wrap items-center gap-5 p-8 max-sm:p-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-white/20 bg-white/10"
          >
            <LifeBuoy className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-foreground/70">
              Help
            </p>
            <h1 className="mt-1 text-3xl font-bold">How this works</h1>
            <p className="mt-2 max-w-xl text-primary-foreground/80">
              Scheduling meetings, checking people in, and keeping the record
              afterwards. Written from what the system actually does.
            </p>
          </div>
          {/* The tour shows itself once and then remembers. This is the way
              back for anyone who clicked past it. */}
          <div className="ml-auto rounded-[1.25rem] bg-white/10 p-1">
            <StartTourButton />
          </div>
        </div>
      </div>

      <HelpBrowser supportEmail={supportEmail} />

      <section className="rounded-[1.5rem] border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary"
          >
            {supportEmail ? (
              <Mail className="h-5 w-5" />
            ) : (
              <UserCog className="h-5 w-5" />
            )}
          </span>
          <h2 className="font-semibold text-primary">
            If the answer is not here
          </h2>
        </div>

        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          Your ministry administrator is the fastest route for anything about
          accounts, access, passwords, or a meeting that belongs to someone
          else. They can act on it directly. When you ask, say what you were
          doing and what happened instead.
        </p>

        {supportEmail && (
          <>
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Mail className="h-4 w-4" aria-hidden="true" /> {supportEmail}
            </a>
            <p className="mt-3 text-sm text-muted-foreground">
              For problems with the platform itself rather than with a
              particular meeting.
            </p>
          </>
        )}
        {/* The old version promised "Monday–Friday, 9am–5pm" beside an address
            that did not exist. Nothing in this system tracks a support rota, so
            there is no honest version of that sentence to print. */}
      </section>
    </PageContainer>
  );
}
