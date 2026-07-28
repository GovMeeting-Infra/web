'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Monitor, Lock, Database, Download } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import type { UserPreferences } from '@/lib/types/account';

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-border'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function Row({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-4 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {control}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
          {icon}
        </span>
        <h2 className="font-semibold text-primary">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Streams the export to a file. Uses fetch rather than a plain link so the
   * session cookie is sent and a failure surfaces as a message instead of the
   * browser navigating to an error body.
   */
  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/v1/me/export', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Could not prepare your data.');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smart-meeting-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'Could not prepare your data.',
      });
    } finally {
      setIsExporting(false);
    }
  };
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-preferences'],
    queryFn: () => apiFetch<UserPreferences>('/api/v1/me/preferences'),
  });

  useEffect(() => {
    if (data && !prefs) setPrefs(data);
  }, [data, prefs]);

  const set = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) =>
    setPrefs((p) => (p ? { ...p, [key]: value } : p));

  const handleSave = async () => {
    if (!prefs) return;
    setIsSaving(true);
    setMessage(null);
    try {
      await apiFetch('/api/v1/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          emailNotifications: prefs.emailNotifications,
          minutesNotifications: prefs.minutesNotifications,
          meetingReminders: prefs.meetingReminders,
          actionItemNotifications: prefs.actionItemNotifications,
          compactMode: prefs.compactMode,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['my-preferences'] });
      // Compact mode is applied by the server-rendered shell, so the new
      // density only appears once that re-renders.
      router.refresh();
      setMessage({ ok: true, text: 'Settings saved.' });
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to save settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !prefs) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {error instanceof Error ? error.message : 'Loading settings…'}
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
          Workspace
        </p>
        <h1 className="text-3xl font-bold text-primary">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage how the workspace behaves for you
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            message.ok
              ? 'border-ring/20 bg-[#edf8f1] text-ring'
              : 'border-destructive/20 bg-destructive/5 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      <Section icon={<Bell className="h-5 w-5" />} title="Notifications">
        <Row
          title="Email notifications"
          description="Receive notifications about events and invitations"
          control={
            <Toggle
              checked={prefs.emailNotifications}
              onChange={(v) => set('emailNotifications', v)}
              disabled={isSaving}
            />
          }
        />
        <Row
          title="Meeting reminders"
          description="Get reminders before upcoming meetings"
          control={
            <Toggle
              checked={prefs.meetingReminders}
              onChange={(v) => set('meetingReminders', v)}
              disabled={isSaving}
            />
          }
        />
        <Row
          title="Minutes published"
          description="Be notified when minutes are published for your events"
          control={
            <Toggle
              checked={prefs.minutesNotifications}
              onChange={(v) => set('minutesNotifications', v)}
              disabled={isSaving}
            />
          }
        />
        <Row
          title="Action item updates"
          description="Be notified when action items are assigned or updated"
          control={
            <Toggle
              checked={prefs.actionItemNotifications}
              onChange={(v) => set('actionItemNotifications', v)}
              disabled={isSaving}
            />
          }
        />
      </Section>

      <Section icon={<Monitor className="h-5 w-5" />} title="Display">
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          The ministry workspace uses the standard light interface across all
          sections.
        </div>
        <div className="mt-4">
          <Row
            title="Compact mode"
            description="Preference is saved, but layout density is not yet applied"
            control={
              <Toggle
                checked={prefs.compactMode}
                onChange={(v) => set('compactMode', v)}
                disabled={isSaving}
              />
            }
          />
        </div>
      </Section>

      <Section icon={<Lock className="h-5 w-5" />} title="Privacy & Security">
        <Row
          title="Two-factor authentication"
          description="Adds a second step when signing in"
          control={
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"
            >
              Coming soon
            </button>
          }
        />
      </Section>

      {/* The session-timeout control lived here. It was removed rather than
          fixed: sessions are governed centrally by a 12-hour inactivity window,
          and a control that saved a value nothing read was worse than none. */}
      <Section icon={<Database className="h-5 w-5" />} title="Data & Storage">
        <Row
          title="Your data"
          description="Download everything this platform holds about you, as a JSON file"
          control={
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Preparing…' : 'Download'}
            </button>
          }
        />
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Sessions end after 12 hours without activity. Signing out from the
            sidebar ends yours immediately.
          </p>
        </div>
      </Section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
