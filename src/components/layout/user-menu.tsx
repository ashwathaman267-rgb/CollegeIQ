'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Settings2, ShieldCheck, UserRound } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ROLE_LABEL } from '@/lib/permissions';
import { useSession, useSignOut } from '@/hooks/use-session';
import { Avatar } from '@/components/ui/avatar';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { ConfirmDialog } from '@/components/ui/dialog';

export function UserMenu({ className, compact }: { className?: string; compact?: boolean }) {
  const { user, session } = useSession();
  const signOut = useSignOut();
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);

  if (!user) return null;
  const name = `${user.firstName} ${user.lastName}`;

  return (
    <>
      <Dropdown>
        <DropdownTrigger
          className={cn(
            'flex items-center gap-2 rounded-md border border-transparent p-1 pr-2 transition-colors hover:border-line hover:bg-raised',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45',
            className,
          )}
          aria-label={`Account menu for ${name}`}
        >
          <Avatar name={name} src={user.avatarUrl} size="sm" />
          {compact ? null : (
            <span className="hidden min-w-0 text-left lg:block">
              <span className="block max-w-[9rem] truncate text-[0.8125rem] font-medium leading-tight text-ink">{name}</span>
              <span className="block text-2xs leading-tight text-subtle">{ROLE_LABEL[user.role]}</span>
            </span>
          )}
        </DropdownTrigger>

        <DropdownContent align="end" className="min-w-[14rem]">
          <DropdownLabel>
            <span className="normal-case tracking-normal text-[0.8125rem] font-semibold text-ink">{name}</span>
            <span className="mt-0.5 block truncate text-2xs font-normal normal-case tracking-normal text-subtle">{user.email}</span>
          </DropdownLabel>
          <DropdownSeparator />
          <DropdownItem icon={<UserRound />} onSelect={() => router.push('/profile')}>
            My profile
          </DropdownItem>
          <DropdownItem icon={<Bell />} onSelect={() => router.push('/notifications')}>
            Notifications
          </DropdownItem>
          <DropdownItem icon={<Settings2 />} onSelect={() => router.push('/settings')}>
            {user.role === 'ADMIN' ? 'Institution settings' : 'Preferences'}
          </DropdownItem>
          <DropdownSeparator />
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-2xs text-subtle">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">
              {ROLE_LABEL[user.role]}
              {session?.ai ? ` · AI ${session.ai.label}` : ''}
            </span>
          </div>
          <DropdownSeparator />
          <DropdownItem icon={<LogOut />} tone="danger" onSelect={() => setConfirming(true)}>
            Sign out
          </DropdownItem>
        </DropdownContent>
      </Dropdown>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Sign out of CampusIQ?"
        description="You will need your email and password to sign back in. Unsaved form entries on this page will be lost."
        confirmLabel="Sign out"
        tone="brand"
        loading={signOut.isPending}
        onConfirm={async () => {
          await signOut.mutateAsync();
          setConfirming(false);
        }}
      />
      <Link href="/profile" className="sr-only">
        Profile
      </Link>
    </>
  );
}
