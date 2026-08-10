import { Mail, LifeBuoy } from 'lucide-react';
import { HelpBrowser } from './HelpBrowser';
import { StartTourButton } from '@/components/tour/StartTourButton';

const SUPPORT_EMAIL = 'support@ministry.gov.sl';

// Static apart from the browser's own filter state: no session lookup and no
// data fetching, so the page itself stays a server component.
export default function HelpPage() {
  return (
    <div className="w-full space-y-6 p-8">
      <div className="overflow-hidden rounded-[1.75rem] border border-border bg-primary text-primary-foreground">
        <div className="flex flex-wrap items-center gap-5 p-8">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-white/20 bg-white/10">
            <LifeBuoy className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-foreground/70">
              Support resources
            </p>
            <h1 className="mt-1 text-3xl font-bold">Help Centre</h1>
            <p className="mt-2 max-w-xl text-primary-foreground/80">
              Answers to the questions people ask most about scheduling
              meetings, checking attendees in, and keeping a record afterwards.
            </p>
          </div>
          {/* The tour shows itself once and then remembers. This is the way
              back for anyone who clicked past it. */}
          <div className="ml-auto rounded-[1.25rem] bg-white/10 p-1">
            <StartTourButton />
          </div>
        </div>
      </div>

      <HelpBrowser supportEmail={SUPPORT_EMAIL} />

      <section className="rounded-[1.5rem] border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
            <Mail className="h-5 w-5" />
          </span>
          <h2 className="font-semibold text-primary">Still need help?</h2>
        </div>

        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          If your question is not answered above, get in touch and describe what
          you were doing and what happened. For account, access and password
          problems your own ministry administrator can usually help fastest.
        </p>

        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
        </a>
        <p className="mt-3 text-sm text-muted-foreground">
          Response times: Monday–Friday, 9am–5pm.
        </p>
      </section>
    </div>
  );
}
