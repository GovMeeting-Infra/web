import { HelpCircle, BookOpen, Mail, ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'How do I check in to an event using a QR code?',
    a: 'Open the event and choose Check-in QR. Scanning the code opens a check-in page where you sign your name and, if the venue has coordinates set, your location is verified. Codes rotate every five minutes, so a screenshot of an old code will not work.',
  },
  {
    q: 'Can I book a conference room for my meeting?',
    a: 'Rooms are booked as part of scheduling an activity. Choose a room on the Schedule Activity form and the booking is made with it. The Rooms section shows each room’s availability and what is already scheduled there.',
  },
  {
    q: 'How do I RSVP to an event invitation?',
    a: 'Invitations arrive with an RSVP link. You can also open the event inside the workspace and use the Your RSVP panel to confirm or decline, and you may change your answer later.',
  },
  {
    q: 'Who can publish meeting minutes?',
    a: 'The event organizer or a co-organizer publishes minutes. Publishing requires the minutes to have content and the event to have at least one attendee. Ministry admins can edit minutes after the two-day editing window has closed.',
  },
  {
    q: 'What is geofencing and why does it matter?',
    a: 'If an event venue has coordinates and a radius, check-ins are verified against the attendee’s device location. It confirms that whoever checked in was actually at the venue, and the accuracy of each reading is recorded alongside the attendance.',
  },
  {
    q: 'Can I change my profile picture and name?',
    a: 'Yes. Open Profile and choose Edit Profile. You can change your name, job title and picture, and set a new password from the same form.',
  },
  {
    q: 'How do I track action items assigned to me?',
    a: 'Action Items shows every task from your ministry’s meeting minutes as a board or a table. Filter by assignee to see only your own, and move a card or change its status to update progress.',
  },
  {
    q: 'Who can add rooms?',
    a: 'Ministry administrators and ministers add rooms from the Rooms page. Once added, a room becomes selectable when anyone schedules an activity.',
  },
];

const FEATURES = [
  ['Check-in system', 'Rotating QR codes with optional location verification.'],
  ['Room booking', 'Rooms are reserved as part of scheduling an activity.'],
  ['Invitations', 'Invite colleagues or external guests and collect RSVPs.'],
  ['Minutes & actions', 'Draft and publish minutes, then track the actions they create.'],
  ['Audit trail', 'Every state-changing action is recorded against its actor.'],
];

// Fully static: no session lookup, no data fetching.
export default function HelpPage() {
  return (
    <div className="w-full space-y-6 p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
          Support resources
        </p>
        <h1 className="text-3xl font-bold text-primary">Help &amp; Centre</h1>
        <p className="mt-2 text-muted-foreground">
          Find answers and learn how to use the workspace
        </p>
      </div>

      <section className="rounded-[1.5rem] border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
            <HelpCircle className="h-5 w-5" />
          </span>
          <h2 className="font-semibold text-primary">Frequently asked questions</h2>
        </div>

        <div className="divide-y divide-border">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-3">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium text-foreground marker:content-['']">
                {f.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
            <BookOpen className="h-5 w-5" />
          </span>
          <h2 className="font-semibold text-primary">Documentation</h2>
        </div>

        <ul className="space-y-2">
          {FEATURES.map(([name, desc]) => (
            <li key={name} className="text-sm">
              <span className="font-medium text-foreground">{name}</span>
              <span className="text-muted-foreground"> — {desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[1.5rem] border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
            <Mail className="h-5 w-5" />
          </span>
          <h2 className="font-semibold text-primary">Contact support</h2>
        </div>

        <a
          href="mailto:support@smartmeeting.gov.sl"
          className="inline-flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          <Mail className="h-4 w-4" /> support@smartmeeting.gov.sl
        </a>
        <p className="mt-3 text-sm text-muted-foreground">
          Response times: Monday–Friday, 9am–5pm.
        </p>
      </section>
    </div>
  );
}
