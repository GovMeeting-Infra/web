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

/**
 * Every answer here is written from the code, not from the plan.
 *
 * A previous version described the product as designed rather than as built,
 * and about half of it had drifted. One line was worse than absent: it promised
 * that a newly saved meeting sends nothing out until you publish it, while
 * createEvent (events.service.ts) emails every invitee the moment you save. An
 * organiser who trusted that sentence sent half-finished invitations.
 *
 * If you change behaviour, change the answer in the same commit. The file:line
 * references in these comments are the check.
 */
const GROUPS: Group[] = [
  {
    title: 'Getting started',
    icon: <LogIn className="h-5 w-5" />,
    tint: 'border-stat-blue-border bg-stat-blue-bg text-primary',
    faqs: [
      {
        q: 'How do I get an account?',
        // invites.service.ts:15 INVITE_TTL_DAYS = 7; link is single-use (:132).
        a: 'Your ministry administrator creates it. There is no public sign-up, so nobody can register themselves. Once yours exists you get an invitation link to set your own password. It works once and lasts seven days. If it has expired, ask your administrator for another.',
      },
      {
        q: 'Why is my email address being rejected when I sign in?',
        a: 'Only government addresses can sign in. Yours has to end in .gov.sl, and a personal address is refused even when an account exists for you. If your address is right and it is still refused, it may have been typed wrongly when your account was made. Your ministry administrator can correct it.',
      },
      {
        q: 'I have forgotten my password. What now?',
        // password-reset.service.ts:15 RESET_TTL_MINUTES = 60 — the old answer
        // never mentioned this, and people were opening the link next morning.
        a: 'Use the forgotten-password link on the sign-in page. The email arrives with a reset link that lasts one hour, so open it while you are still at your desk. If you cannot get in at all, your ministry administrator can send you a fresh invitation, which sets a new password without needing the old one.',
      },
    ],
  },
  {
    title: 'Meetings and events',
    icon: <CalendarDays className="h-5 w-5" />,
    tint: 'border-stat-green-border bg-stat-green-bg text-success',
    faqs: [
      {
        q: 'What happens when I save a new meeting?',
        // events.service.ts:213 status: dto.isPublic ? 'DRAFT' : 'PUBLISHED',
        // and :254-262 notifyMeetingInvitation + sendInvitations inside create.
        a: 'It goes live straight away and the invitations go out with it. There is no draft step for an internal meeting and no separate publish button, so have the time, the place and the guest list right before you save. If you are still working things out, save it with nobody invited and add people once it is settled.',
      },
      {
        q: 'What is the difference between an internal meeting and a public activity?',
        // Publish path is public-only (events.service.ts:734-738). Minutes are
        // refused on public activities (minutes.service.ts:53-57).
        a: 'An internal meeting is private to your ministry and the people invited. A public activity goes on the government-wide public calendar, where anyone can see it. Public activities are held as drafts until a ministry administrator publishes them, they belong to the ministry rather than to you, and they do not have minutes.',
      },
      {
        q: 'How do I invite people, including guests from outside government?',
        // rsvp.service.ts:78-80 rejects a second response from a token.
        a: 'Use the attendees section on the event. Colleagues are invited through their accounts. Guests from outside government are added by name and email and get a link that lets them reply without an account. Colleagues can change their answer whenever they like. A guest replying by that link gets one reply only, so if their plans change, they need to tell you and you update it.',
      },
      {
        q: 'Can I set a meeting to repeat?',
        // event-series.service.ts:122-142 seven frequencies; :76 count || 52.
        a: 'Yes. Turn the event into a series when you schedule it and pick how often: daily, weekly, weekdays only, fortnightly, monthly, quarterly or yearly. Set a number of occurrences, or leave it open and 52 are created. Each occurrence is a real meeting you can edit or cancel on its own without touching the rest.',
      },
      {
        q: 'Who can change or cancel a meeting?',
        // can-manage-event.guard.ts:30 — delete/publish/cancel keep the
        // narrower rule, so a co-organizer genuinely cannot cancel.
        a: 'The organiser can do everything. Co-organisers can edit the details and run the meeting, but cancelling and deleting stay with the organiser. Ministry administrators can edit meetings across their own ministry, though a meeting with a named organiser stays that person’s to cancel. Cancelling keeps the meeting and its attendance record; deleting removes it, which is why only the organiser can.',
      },
    ],
  },
  {
    title: 'Check-in and attendance',
    icon: <QrCode className="h-5 w-5" />,
    tint: 'border-stat-gold-border bg-stat-gold-bg text-stat-gold-fg',
    faqs: [
      {
        q: 'How do attendees check in?',
        a: 'Open the meeting and press Generate QR code, then show it on a screen or your phone at the door. People scan it, type their name and draw their signature. Each check-in shows on the meeting as it happens, so you can watch the room fill up and see who is still missing.',
      },
      {
        q: 'Why do I have to generate the code at the venue?',
        // geofence.constants.ts GEOFENCE_RADIUS_METERS = 100, anchored to the
        // organizer's position at mint time.
        a: 'Because where you are standing when you generate it becomes the check-in area. Everyone scanning has to be within 100 metres of that spot. Generate it the night before or from your office and you have drawn the area around the wrong place, and the people in the room cannot check in. Do it once you have arrived.',
      },
      {
        q: 'Can someone check in using a screenshot of the code?',
        a: 'No. A code lasts five minutes, and you can generate a new one whenever you want from the same screen. A photograph passed to someone stops working almost immediately, and even a code that is still valid will not let them in unless they are standing inside the check-in area.',
      },
      {
        q: 'Someone without an account needs to check in. Can they?',
        a: 'Yes, as long as guest check-in is on for that meeting. When they scan they can check in as a guest by giving their name, email, job title, organisation and phone number, and drawing a signature. Anyone who was not on the invitation list is recorded as a walk-in, so you can tell the two apart later. Turn guest check-in off and only people with accounts can check in.',
      },
      {
        q: 'Why was a check-in refused?',
        // GEO_ERROR in geofence.constants.ts: LOCATION_REQUIRED (the common
        // one, and the old answer omitted it entirely), ACCURACY_TOO_LOW,
        // OUTSIDE_AREA.
        a: 'Most often the phone never sent a location at all, because the browser asked permission and the person said no or dismissed it. Ask them to allow location and scan again. The other reasons are standing outside the 100-metre area, a location reading too vague to judge, or a code that has expired. Check-in also closes when the meeting ends, and nobody can check in twice. If someone truly cannot, record them yourself from the attendees screen.',
      },
      {
        q: 'What does the location column on the attendance list mean?',
        // The four verdicts LocationCell renders (CheckedInTable.tsx), plus the
        // accuracy figure and the mock-GPS flag. This was a legend under the
        // table itself until it moved here, so keep it in step with that
        // component.
        a: 'It reports where the phone said the person was when they checked in, as one of four verdicts. Verified means the phone placed them inside the check-in area the organiser set. Outside area means it placed them outside it, even allowing for the margin of error — the check-in still counts, and the location is kept for the audit log. Unconfirmed means a location arrived but was too vague to settle it either way, which indoors is common and is not evidence of anything. Not verified means no location was checked at all, either because no area was set for that meeting or because an organiser recorded them at the desk. A figure such as ±40m is how accurate the phone said its position was, and the smaller the number the more certain it is. A Mock GPS flag means the phone reported a position a real one cannot produce, usually a location-spoofing app; it is recorded as a flag and not as proof, so check the audit log before acting on it.',
      },
    ],
  },
  {
    title: 'Minutes and action items',
    icon: <ClipboardList className="h-5 w-5" />,
    tint: 'border-stat-violet-border bg-stat-violet-bg text-stat-violet-fg',
    faqs: [
      {
        q: 'What goes into the minutes?',
        a: 'The decisions the meeting reached, the action items it produced and the next steps it agreed. Nothing else. Each decision and next step is one line, on purpose: the record is meant to be read in a minute, not to reproduce the discussion.',
      },
      {
        q: 'What is the difference between an action item and a next step?',
        a: 'An action item has a name on it and a date it is due, and it stays on the Action Items board until someone finishes it. A next step is what happens next with nobody to chase, like reconvening once the budget review lands. It is written down but never assigned.',
      },
      {
        q: 'Who writes and publishes the minutes?',
        // minutes.service.ts:258-266 both preconditions; listMinutes (:415-435)
        // scopes by ministry only, so a draft is visible though not editable.
        a: 'The organiser or a co-organiser drafts them on the meeting and publishes when ready. Publishing needs at least one decision, action item or next step written down, and at least one attendee on the meeting. Only the organising team can edit a draft, but others in your ministry can see that one exists, so a draft is not a private notebook.',
      },
      {
        q: 'How long can minutes be edited after a meeting?',
        // EDIT_WINDOW_DAYS = 2; archive.policy.ts:11 ARCHIVE_AFTER_MONTHS = 6
        // freezes them for everyone, which the old answer denied outright.
        a: 'Two days after the meeting ends, which covers the usual round of corrections. After that your ministry administrators can still make changes. Six months on, minutes are archived and then nobody can change them, including administrators, so anything that matters should be fixed well before that.',
      },
      {
        q: 'How do action items work, and when am I reminded?',
        // tasks.service.ts:47 @Cron('0 8 * * *') matching the calendar day the
        // item is due — no advance warning exists, despite the old wording.
        // BOARD_COLUMNS has three columns, not five.
        a: 'They are the tasks a meeting produces, recorded against its minutes with an owner and a due date. The board collects them from every meeting so nothing falls between one and the next. It has three columns — To Do, In Progress and Done — with blocked items sitting in To Do and cancelled ones in Done. Owners get an email at 8am on the day an item is due. There is no earlier warning, so treat the due date as the day it lands, not the deadline you are reminded to prepare for.',
      },
    ],
  },
  {
    title: 'Your account',
    icon: <UserCircle className="h-5 w-5" />,
    tint: 'border-stat-green-border bg-stat-green-bg text-success',
    faqs: [
      {
        q: 'Why was I signed out?',
        a: 'After a stretch without activity. You get a warning shortly before it happens with the option to stay signed in, and anything already saved is safe. The length is set for the whole platform, so it can differ between deployments. On a shared or public computer, use Sign Out in the sidebar rather than just closing the window.',
      },
      {
        q: 'How do I change my name, photo, phone number or password?',
        // The Profile page is now sections with their own save buttons; the
        // "Edit Profile" button the old answer named no longer exists.
        a: 'Open Profile from the sidebar. Your details, your password and your data each have their own section, and each saves on its own. Your name is worth getting right because it appears on every attendance record you sign. Your work phone is optional and gets recorded against your attendance so an organiser can reach you. Your email address, ministry and access level are set by your administrator and cannot be changed here.',
      },
      {
        q: 'Can I turn off the emails this sends me?',
        // Settings was folded into Profile, and the notification toggles were
        // removed before that (commit 740aadd) because these emails became
        // part of the service. The old answer described both as still there.
        a: 'Mostly no, and that is deliberate. Invitations, reminders, published minutes and anything assigned to you are part of the service, because they tell you about something you are expected at or answerable for. The one exception is the Monday summary of your open action items, and every one of those carries a link to stop receiving it. There is no separate Settings page any more; display options moved into Profile.',
      },
    ],
  },
];

const TOTAL = GROUPS.reduce((n, g) => n + g.faqs.length, 0);

export function HelpBrowser({ supportEmail }: { supportEmail?: string }) {
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
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help — try “check in”, “minutes” or “RSVP”"
            // border-muted-foreground, not border-border. This is the one
            // control on the page, and against the card the default border came
            // to 1.31:1 while the fill differed by 1.03:1 — so the field barely
            // read as somewhere you could type.
            className="w-full rounded-xl border border-muted-foreground bg-muted/40 py-2.5 pl-9 pr-9 text-sm text-foreground placeholder-muted-foreground focus:border-primary"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {/* Announced, because filtering happens as you type and the only signal
            that it worked is this line changing. */}
        <p
          role="status"
          aria-live="polite"
          className="mt-2 text-xs text-muted-foreground"
        >
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
            Try a different word. For anything about your account, access or
            password, your ministry administrator can usually sort it faster
            than anyone.
          </p>
          {supportEmail && (
            <a
              href={`mailto:${supportEmail}`}
              className="mt-5 inline-flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Mail className="h-4 w-4" aria-hidden="true" /> Contact support
            </a>
          )}
        </div>
      ) : (
        filtered.map((group) => (
          <section
            key={group.title}
            className="rounded-[1.5rem] border border-border bg-card p-6"
          >
            <div className="mb-4 flex items-center gap-3">
              <span
                aria-hidden="true"
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
                  <summary className="flex cursor-pointer items-center justify-between gap-4 marker:content-['']">
                    {/* A real heading, so the rotor reaches all 21 questions.
                        They were plain summary text, which meant heading
                        navigation found the five category titles and stopped —
                        on a page whose entire purpose is the questions. */}
                    <h3 className="text-sm font-medium text-foreground">
                      {f.q}
                    </h3>
                    <ChevronDown
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    />
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
