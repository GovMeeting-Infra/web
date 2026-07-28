import { Suspense } from 'react';
import { SearchResultsView } from './SearchResultsView';

// useSearchParams needs a Suspense boundary, as on the public calendar pages.
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-muted-foreground">Loading search…</div>
      }
    >
      <SearchResultsView />
    </Suspense>
  );
}
