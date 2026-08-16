import { redirect } from 'next/navigation';

/**
 * Settings has been folded into the account page.
 *
 * The split had the password on Profile behind a button labelled "Edit
 * Profile", two-factor on Settings as a disabled "Coming soon", and how
 * sessions expire explained under "Data & Storage" — so someone who thought
 * their account was compromised went looking under Settings/Security and found
 * a dead end. Between the two pages there was one working preference.
 *
 * Kept as a redirect rather than deleted: this path is in people's bookmarks
 * and in the user menu of any tab that has been open since before the change.
 */
export default function SettingsPage() {
  redirect('/administrative/profile');
}
