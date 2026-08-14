import { Suspense } from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageHeaderSkeleton, ListSkeleton } from '@/components/ui/skeletons';
import { SearchResultsView } from './SearchResultsView';

// useSearchParams needs a Suspense boundary, as on the public calendar pages.
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <PageHeaderSkeleton />
          <ListSkeleton rows={4} label="Loading search" />
        </PageContainer>
      }
    >
      <SearchResultsView />
    </Suspense>
  );
}
