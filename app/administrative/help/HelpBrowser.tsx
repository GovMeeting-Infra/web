'use client';

import { useMemo, useState } from 'react';
import {
  Search,
  X,
  ChevronDown,
  LogIn,
  CalendarDays,
  QrCode,
  ClipboardList,
  UserCircle,
  Mail,
} from 'lucide-react';

interface Faq {
  q: string;
  a: string;
}

interface Group {
  title: string;
  icon: React.ReactNode;
  tint: string;
  faqs: Faq[];
}

const GROUPS: Group[] = [
  {
    title: 'Getting started',
    icon: <LogIn className="h-5 w-5" />,
    tint: 'border-[#c9d9f2] bg-[#edf3fd] text-[#003580]',
    faqs: [
      {
        q: 'How do I get an account?',
        a: 'Accounts are created by your ministry administrator — there is no public sign-up. Once yours is created you receive an invitation link to set your own password. The link works once and expires after seven days, so use it as soon as it arrives. If it has already expired, ask your administrator to send a new one.',
      },
      {
        q: 'Why is my email address being rejected at sign-in?',
        a: 'Only government addresses can sign in. Your address must end in .gov.sl — a personal address will be refused even if an account exists. If you believe your address is correct and it is still rejected, your account may have been created with a typo; your ministry administrator can correct it.',
      },
      {
        q: 'I have forgotten my password. What now?',
        a: 'Use the forgotten-password option on the sign-in page to receive a reset link. If you cannot get in at all, your ministry administrator can issue you a fresh invitation link, which lets you set a new password without knowing the old one.',
      },
    ],
  },
  {
    title: 'Meetings and events',
    icon: <CalendarDays className="h-5 w-5" />,
    tint: 'border-[#cfe5d7] bg-[#edf8f1] text-[#007236]',
    faqs: [
      {
        q: 'How do I schedule a meeting?',
        a: 'Open Events and choose to schedule a new one. Give it a title, a start and end time, and where it is being held. A new event is saved as a draft, which means only you and your co-organizers can see it. It becomes visible to attendees when you publish it, so nothing is sent out by accident while you are still arranging details.',
      },
      {
        q: 'What is the difference between an internal meeting and a public activity?',
        a: 'An internal meeting is private to your ministry and its invitees. A public activity appears on the public calendar that spans government once published, so anyone can see it is happening. Public activities are not owned by one person, which means your ministry administrators manage and publish them rather than an individual organizer.',
      },
      {
        q: 'How do I invite people, including guests from outside government?',
        a: 'On the event, use the attendees section. Colleagues are invited through their existing accounts. Guests from outside government are added by name and email, and receive an invitation link that lets them respond without an account. Everyone invited can confirm or decline, and can change their answer later if their plans change.',
      },
      {
        q: 'Can I set a meeting to repeat?',
        a: 'Yes. When scheduling, turn the event into a series and choose how often it repeats — daily, weekly, weekdays only, every two weeks, monthly, quarterly or yearly. You can either set a number of occurrences or let it run on, in which case up to 52 are created. Each occurrence is a real event you can edit or cancel on its own.',
      },
      {
        q: 'Who can change or cancel an event?',
        a: 'The organizer has full control. Co-organizers can edit the details and cancel the meeting, but cannot delete it or publish it for the first time. Ministry administrators can manage events across their own ministry. Cancelling keeps the event and its record; deleting removes it entirely, which is why it is restricted to the organizer.',
      },
    ],
  },
  {
    title: 'Check-in and attendance',
    icon: <QrCode className="h-5 w-5" />,
    tint: 'border-[#fde8a6] bg-[#fff8e5] text-[#8d6400]',
    faqs: [
      {
        q: 'How do attendees check in?',
        a: 'Open the event and press Generate QR code, then display the code on a screen or phone at the door. Attendees scan it, sign their name, and draw a signature to confirm they were present. Their check-in appears on the event immediately, so you can see who has arrived as the meeting fills up.',
      },
      {
        q: 'Why do I have to generate the code at the venue?',
        a: 'Wherever you are standing when you generate the code becomes the check-in area, and attendees must be within 100 metres of that spot to check in. That is what stops someone checking in from home or from another building. Generate the code in the room itself, once you have arrived — not the night before, and not from your office.',
      },
      {
        q: 'Can someone check in using a screenshot of the code?',
        a: 'No. Each code expires after five minutes, and you can generate a fresh one at any time from the same screen. A photograph of the code stops working almost immediately, and even a current code still requires the person to be inside the check-in area.',
      },
      {
        q: 'Someone without an account needs to check in. Can they?',
        a: 'Yes. When they scan the code they can choose to check in as a guest, giving their name, email address and signature. Guests who were not on the invitation list are recorded as walk-ins so you can tell them apart afterwards. If a meeting should be staff only, turn off guest check-in on the event and only people with accounts can check in.',
      },
      {
        q: 'Why was a check-in refused?',
        a: 'The usual reasons are being outside the 100-metre check-in area, a location reading too imprecise to trust, or a code that has expired — generate a new one. Check-in also closes once the meeting has ended, and nobody can check in twice to the same meeting. If someone genuinely cannot check in, an organizer can record their attendance manually from the attendees screen.',
      },
    ],
  },
  {
    title: 'Minutes and action items',
    icon: <ClipboardList className="h-5 w-5" />,
    tint: 'border-[#d9cff2] bg-[#f3effd] text-[#4c1d95]',
    faqs: [
      {
        q: 'Who writes and publishes the minutes?',
        a: 'The organizer or a co-organizer drafts the minutes on the event and publishes them when they are ready. Publishing needs the minutes to actually contain something and the meeting to have at least one attendee. Drafts are private to the organizing team, so you can work on them across several sittings before anyone else sees them.',
      },
      {
        q: 'How long can minutes be edited after a meeting?',
        a: 'The organizing team can edit minutes for two days after the meeting ends, which covers the usual round of corrections. After that window closes, your ministry administrators can still make changes, so genuine errors can always be fixed — it simply becomes a deliberate act rather than a casual one.',
      },
      {
        q: 'How do action items work?',
        a: 'Action items are the tasks that come out of a meeting and are recorded against its minutes. Each one has an owner, a due date and a status: To do, In progress, Blocked, Completed or Cancelled. The Action Items board collects them across all your meetings so nothing is lost between one meeting and the next, and you are reminded as a due date approaches.',
      },
    ],
  },
  {
    title: 'Your account',
    icon: <UserCircle className="h-5 w-5" />,
    tint: 'border-[#cfe5d7] bg-[#edf8f1] text-[#007236]',
    faqs: [
      {
        q: 'Why was I signed out?',
        a: 'You are signed out after 12 hours of inactivity. Sign in again to carry on — nothing you had already saved is lost. If you are working on a shared or public computer, use Sign Out in the sidebar when you finish rather than simply closing the window.',
      },
      {
        q: 'How do I change my name, photo or password?',
        a: 'Open Profile from the sidebar and choose Edit Profile. You can change your display name, job title and picture there, and set a new password from the same form by entering your current one first. Your email address, role and ministry are set by your administrator and cannot be changed from here.',
      },
      {
        q: 'What can I control in Settings?',
        a: 'Settings holds your notification preferences — whether you hear about meeting reminders, published minutes and action items assigned to you — along with display and session options. Changes apply to your own account only and take effect as soon as you save.',
      },
    ],
  },
];

const TOTAL = GROUPS.reduce((n, g) => n + g.faqs.length, 0);

export function HelpBrowser({ supportEmail }: { supportEmail: string }) {
  const [query, setQuery] = useState('');

  const term = query.trim().toLowerCase();

  // Matches answers as well as questions, so searching a word that only appears
  // in the body — "geofence", "walk-in" — still finds the right entry.
  const filtered = useMemo(() => {
    if (!term) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      faqs: g.faqs.filter(
        (f) =>
          f.q.toLowerCase().includes(term) || f.a.toLowerCase().includes(term),
      ),
    })).filter((g) => g.faqs.length > 0);
  }, [term]);

  const matchCount = filtered.reduce((n, g) => n + g.faqs.length, 0);

  return (
    <>
      <div className="rounded-[1.5rem] border border-border bg-card p-5">
        <label htmlFor="faq-search" className="sr-only">
          Search help topics
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help — try “check in”, “minutes” or “RSVP”"
            className="w-full rounded-xl border border-border bg-muted/40 py-2.5 pl-9 pr-9 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {term
            ? `${matchCount} of ${TOTAL} ${matchCount === 1 ? 'answer' : 'answers'} match “${query.trim()}”`
            : `${TOTAL} answers across ${GROUPS.length} topics`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[1.5rem] border border-border bg-card p-10 text-center">
          <p className="font-medium text-foreground">
            Nothing here matches “{query.trim()}”
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Try a different word, or get in touch and we will help directly.
          </p>
          <a
            href={`mailto:${supportEmail}`}
            className="mt-5 inline-flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Mail className="h-4 w-4" /> Contact support
          </a>
        </div>
      ) : (
        filtered.map((group) => (
          <section
            key={group.title}
            className="rounded-[1.5rem] border border-border bg-card p-6"
          >
            <div className="mb-4 flex items-center gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${group.tint}`}
              >
                {group.icon}
              </span>
              <h2 className="font-semibold text-primary">{group.title}</h2>
              <span className="ml-auto text-xs font-medium text-muted-foreground">
                {group.faqs.length}
              </span>
            </div>

            <div className="divide-y divide-border">
              {group.faqs.map((f) => (
                <details key={f.q} className="group py-3">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium text-foreground marker:content-['']">
                    {f.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
