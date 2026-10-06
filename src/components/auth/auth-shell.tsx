import * as React from 'react';
import Link from 'next/link';
import { BarChart3, CalendarDays, ClipboardCheck, Sparkles, Trophy } from 'lucide-react';

import { LogoMark } from '@/components/layout/logo';

const MODULES = [
  { icon: ClipboardCheck, title: 'Intelligent attendance', text: 'Risk bands, subject-wise tracking and one-tap marking.' },
  { icon: CalendarDays, title: 'Timetable scheduler', text: 'Constraint engine for faculty, rooms, labs and breaks.' },
  { icon: Trophy, title: 'Result analyser', text: 'University results, pass percentage and arrear timelines.' },
  { icon: Sparkles, title: 'Career matching', text: 'Resume–job alignment with an honest skill-gap plan.' },
];

/**
 * Split-screen authentication shell: the crimson identity panel on the left,
 * the form on the right. Collapses to a single column on phones.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
      {/* Identity panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[rgb(var(--sidebar-bg))] px-10 py-10 text-white lg:flex xl:px-14">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-[0.16]" aria-hidden />
        <div
          className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-brand/25 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <LogoMark size={38} />
            <div>
              <p className="text-lg font-semibold leading-tight tracking-tight">
                Campus<span className="text-brand-400">IQ</span>
              </p>
              <p className="text-xs text-[rgb(var(--sidebar-muted))]">Intelligent Solutions for a Smarter Campus</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-lg space-y-7">
          <h2 className="text-[1.75rem] font-semibold leading-snug tracking-tight">
            One platform for attendance, timetables, results and career readiness.
          </h2>
          <ul className="space-y-4">
            {MODULES.map((module) => (
              <li key={module.title} className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/12 bg-white/[0.06] text-brand-300">
                  <module.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">{module.title}</span>
                  <span className="block text-[0.8125rem] leading-relaxed text-[rgb(var(--sidebar-muted))]">{module.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-2xs text-[rgb(var(--sidebar-muted))]">
          <BarChart3 className="h-3.5 w-3.5" aria-hidden />
          <span>Role-based access · audited actions · configurable institutional rules</span>
        </div>
      </div>

      {/* Form column */}
      <div className="flex flex-col justify-center bg-canvas px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark size={32} />
            <div>
              <p className="text-[0.95rem] font-semibold leading-tight tracking-tight text-ink">
                Campus<span className="text-brand">IQ</span>
              </p>
              <p className="text-2xs text-subtle">Intelligent Solutions for a Smarter Campus</p>
            </div>
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{subtitle}</p> : null}

          <div className="mt-7">{children}</div>

          {footer ? <div className="mt-6 border-t border-line pt-5 text-[0.8125rem] text-muted">{footer}</div> : null}

          <p className="mt-8 text-center text-2xs text-subtle lg:text-left">
            <Link href="/login" className="rounded font-medium text-muted transition-colors hover:text-brand">
              Sign in
            </Link>
            <span className="px-1.5" aria-hidden>·</span>
            <Link href="/register" className="rounded font-medium text-muted transition-colors hover:text-brand">
              Create a student account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
