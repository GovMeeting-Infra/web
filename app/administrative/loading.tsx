import { PageHeaderSkeleton, CardGridSkeleton } from '@/components/ui/skeletons';

/**
 * Shown while a server-rendered administrative page is being produced.
 *
 * There was no route-level boundary anywhere in the app, so every navigation
 * held the previous screen until the new one was ready — which on the
 * connections this is used over reads as a dead button, and had people
 * clicking twice. The skeletons already carry their own role="status" and an
 * sr-only label, so this announces itself to a reader as well.
 */
export default function AdministrativeLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton />
    </div>
  );
}
