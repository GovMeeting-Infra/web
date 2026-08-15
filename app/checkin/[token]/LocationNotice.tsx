import { MapPin } from 'lucide-react';

/**
 * Warns that the browser is about to ask for location, before it asks.
 *
 * The prompt fires on submit, and a permission dialog nobody was expecting
 * gets dismissed — which on a fenced meeting means the person cannot check in
 * at all. Saying so first is the difference between an informed "allow" and a
 * reflexive "block", and a blocked permission cannot be re-requested by
 * tapping again; it has to be undone in browser settings.
 *
 * Shown either way, because location is now recorded on every check-in. Only
 * the consequence differs: with a fence it decides whether you may check in,
 * without one it is simply part of the record.
 */
export function LocationNotice({ required }: { required: boolean }) {
  return (
    <div
      className={`mt-5 flex items-start gap-3 rounded-xl border p-3 text-left ${
        required
          ? 'border-[#fde8a6] bg-[#fff8e5] text-[#8d6400]'
          : 'border-border bg-muted/40 text-muted-foreground'
      }`}
    >
      <MapPin aria-hidden className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <p className="text-xs leading-relaxed">
        {required ? (
          <>
            <span className="font-semibold">
              You must be at the venue to check in.
            </span>{' '}
            When you submit, your browser will ask to share your location.
            Allow it — check-in cannot be completed without it.
          </>
        ) : (
          <>
            When you submit, your browser will ask to share your location. It is
            recorded with your check-in. You can still check in if you decline.
          </>
        )}
      </p>
    </div>
  );
}
