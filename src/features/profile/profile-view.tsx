'use client';

import * as React from 'react';
import { KeyRound, Laptop, LogOut, Moon, Monitor, Sun, UserRound } from 'lucide-react';

import { api } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { useApi, useInvalidate } from '@/hooks/use-api';
import { useSignOut } from '@/hooks/use-session';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { useSession } from '@/hooks/use-session';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Segmented } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { changePasswordSchema, profileSchema } from '@/validations';
import { PasswordField } from '@/components/auth/password-field';
import { ROLE_LABEL } from '@/lib/permissions';

interface SessionRow {
  id: string;
  isCurrent: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

/**
 * The signed-in user's own account: identity, preferences, password and the
 * devices currently signed in.
 */
export function ProfileView() {
  const { user, academic } = useSession();
  const { theme, setTheme } = useTheme();
  const signOut = useSignOut();
  const invalidate = useInvalidate();

  const [firstName, setFirstName] = React.useState(user?.firstName ?? '');
  const [lastName, setLastName] = React.useState(user?.lastName ?? '');
  const [phone, setPhone] = React.useState('');
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [savingProfile, setSavingProfile] = React.useState(false);

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [savingPassword, setSavingPassword] = React.useState(false);

  const sessions = useApi<SessionRow[]>('/api/auth/sessions');
  const [revokingAll, setRevokingAll] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
    }
  }, [user]);

  if (!user) return null;

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError(null);

    const parsed = profileSchema.safeParse({
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      phone: phone.trim() || null,
    });
    if (!parsed.success) {
      setProfileError(parsed.error.issues[0]?.message ?? 'Profile details are invalid.');
      return;
    }

    setSavingProfile(true);
    try {
      await api.patch('/api/auth/profile', parsed.data);
      invalidate('/api/auth/session', '/api/auth/profile');
      toastSuccess('Profile updated', 'Your details were saved.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save your profile.');
      toastError(error, 'Could not save your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setFieldErrors({});

    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!parsed.success) {
      const issues: Record<string, string> = {};
      for (const issue of parsed.error.issues) issues[String(issue.path[0] ?? 'password')] = issue.message;
      setFieldErrors(issues);
      if (!issues.newPassword) setPasswordError(parsed.error.issues[0]?.message ?? 'The new password is invalid.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      });
      invalidate('/api/auth/session', '/api/auth/sessions');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toastSuccess('Password changed', 'Your other sessions were signed out as a precaution.');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Could not change the password.');
      toastError(error, 'Could not change the password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const revokeSession = async (session: SessionRow) => {
    try {
      await api.delete(`/api/auth/sessions/${session.id}`);
      invalidate('/api/auth/sessions');
      toastSuccess('Session signed out', 'That device was signed out.');
    } catch (error) {
      toastError(error, 'Could not sign out that session.');
    }
  };

  const revokeAllOthers = async () => {
    setRevokingAll(true);
    try {
      const result = await api.delete<{ revoked: number }>('/api/auth/sessions');
      invalidate('/api/auth/sessions');
      toastSuccess('Other sessions signed out', `${result.data.revoked} device(s) were signed out.`);
    } catch (error) {
      toastError(error, 'Could not sign out the other sessions.');
    } finally {
      setRevokingAll(false);
    }
  };

  const roleLabel = ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] ?? user.role;

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your identity, preferences and signed-in devices. The password and session controls here are the ones to use when leaving a shared computer."
        icon={<UserRound />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Profile' }]}
      />

      <div className="mt-5 space-y-5">
        <div className="grid gap-5 lg:grid-cols-3">
          <Panel className="h-full">
            <PanelBody className="flex h-full flex-col items-center gap-3 py-6 text-center">
              <Avatar firstName={user.firstName} lastName={user.lastName} src={user.avatarUrl} size="xl" />
              <div>
                <p className="text-base font-semibold text-ink">
                  {user.firstName} {user.lastName}
                </p>
                <p className="mt-0.5 text-sm text-muted">{user.email}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Badge tone="brand">{roleLabel}</Badge>
                {user.registerNumber ? <Badge tone="neutral">Reg {user.registerNumber}</Badge> : null}
                {user.employeeId ? <Badge tone="neutral">Emp {user.employeeId}</Badge> : null}
              </div>
              <div className="mt-1 text-xs text-muted">
                {user.departmentName ? <p>{user.departmentName}</p> : null}
                {user.className ? <p>{user.className}</p> : null}
                {academic ? <p>Semester {academic.semester} · {academic.currentAcademicYearName}</p> : null}
              </div>
              <div className="mt-auto w-full pt-4">
                <Field label="Theme" hint="Stored on your account and this device.">
                  <Segmented<Theme>
                    value={theme}
                    onChange={setTheme}
                    ariaLabel="Theme preference"
                    options={[
                      { value: 'light', label: 'Light', icon: <Sun className="h-3.5 w-3.5" /> },
                      { value: 'dark', label: 'Dark', icon: <Moon className="h-3.5 w-3.5" /> },
                      { value: 'system', label: 'System', icon: <Monitor className="h-3.5 w-3.5" /> },
                    ]}
                  />
                </Field>
              </div>
            </PanelBody>
          </Panel>

          <div className="space-y-5 lg:col-span-2">
            <Panel>
              <PanelHeader title="Personal details" subtitle="Name and phone are used on reports and result sheets." icon={<UserRound />} />
              <PanelBody>
                <form onSubmit={saveProfile} className="space-y-4" noValidate>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="First name" htmlFor="pf-first" required>
                      <Input id="pf-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </Field>
                    <Field label="Last name" htmlFor="pf-last" required>
                      <Input id="pf-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </Field>
                    <Field label="Phone" htmlFor="pf-phone" hint="Optional.">
                      <Input id="pf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                    </Field>
                    <Field label="Email" htmlFor="pf-email" hint="Contact an administrator to change your sign-in email.">
                      <Input id="pf-email" value={user.email} disabled />
                    </Field>
                  </div>
                  {profileError ? (
                    <p className="field-error" role="alert">
                      {profileError}
                    </p>
                  ) : null}
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" size="sm" loading={savingProfile}>
                      Save details
                    </Button>
                  </div>
                </form>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader title="Change password" subtitle="Use at least 8 characters with a letter and a number." icon={<KeyRound />} />
              <PanelBody>
                <form onSubmit={changePassword} className="space-y-4" noValidate>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <PasswordField
                        id="pw-current"
                        label="Current password"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        autoComplete="current-password"
                        error={fieldErrors.currentPassword}
                      />
                    </div>
                    <div>
                      <PasswordField
                        id="pw-new"
                        label="New password"
                        value={newPassword}
                        onChange={setNewPassword}
                        autoComplete="new-password"
                        showStrength
                        error={fieldErrors.newPassword}
                      />
                    </div>
                    <div>
                      <PasswordField
                        id="pw-confirm"
                        label="Confirm new password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        autoComplete="new-password"
                        error={fieldErrors.confirmPassword}
                      />
                    </div>
                  </div>
                  {passwordError ? (
                    <p className="field-error" role="alert">
                      {passwordError}
                    </p>
                  ) : null}
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" size="sm" loading={savingPassword}>
                      Change password
                    </Button>
                  </div>
                </form>
              </PanelBody>
            </Panel>
          </div>
        </div>

        <Panel>
          <PanelHeader
            title="Signed-in devices"
            subtitle="Every place your account is currently active. Signing one out revokes it immediately."
            icon={<Laptop />}
            actions={
              (sessions.data?.data ?? []).length > 1 ? (
                <Button size="sm" variant="secondary" onClick={() => void revokeAllOthers()} loading={revokingAll}>
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign out all other sessions
                </Button>
              ) : null
            }
          />
          <PanelBody>
            {sessions.isLoading ? (
              <p className="py-6 text-center text-sm text-muted">Loading sessions…</p>
            ) : (sessions.data?.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No active sessions.</p>
            ) : (
              <ul className="divide-y divide-line">
                {(sessions.data?.data ?? []).map((session) => (
                  <li key={session.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                        {describeAgent(session.userAgent)}
                        {session.isCurrent ? <Badge tone="brand">This device</Badge> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        IP {session.ipAddress ?? 'unknown'} · active {formatDateTime(session.lastUsedAt)} · expires {formatDateTime(session.expiresAt)}
                      </p>
                    </div>
                    {session.isCurrent ? (
                      <Button size="xs" variant="ghost" onClick={() => signOut.mutate()}>
                        Sign out here
                      </Button>
                    ) : (
                      <Button size="xs" variant="secondary" onClick={() => void revokeSession(session)}>
                        Sign out
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}

function describeAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const lower = userAgent.toLowerCase();
  const browser =
    lower.includes('edg/') || lower.includes('edge/')
      ? 'Edge'
      : lower.includes('chrome/')
        ? 'Chrome'
        : lower.includes('safari/') && lower.includes('version/')
          ? 'Safari'
          : lower.includes('firefox/')
            ? 'Firefox'
            : 'Browser';
  const os = lower.includes('windows') ? 'Windows' : lower.includes('mac os') ? 'macOS' : lower.includes('android') ? 'Android' : lower.includes('linux') ? 'Linux' : 'Device';
  return `${browser} on ${os}`;
}
