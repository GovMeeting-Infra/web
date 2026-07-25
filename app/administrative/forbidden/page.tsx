import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldAlert className="h-7 w-7" />
      </span>

      <h1 className="text-2xl font-bold text-primary">Forbidden</h1>
      <p className="text-sm text-muted-foreground">
        You don&apos;t have permission to view this page. If you think you should,
        ask your ministry administrator to check your role.
      </p>

      <Link
        href="/administrative/dashboard"
        className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
