import type { Metadata, Viewport } from 'next';

import './globals.css';
import { Providers } from '@/components/providers';
import { THEME_INIT_SCRIPT } from '@/hooks/use-theme';

export const metadata: Metadata = {
  title: {
    default: 'CampusIQ — Intelligent Solutions for a Smarter Campus',
    template: '%s · CampusIQ',
  },
  description:
    'CampusIQ unifies intelligent attendance management, department timetable scheduling, academic and university result analysis, and AI resume–job matching in one campus platform.',
  applicationName: 'CampusIQ',
  keywords: ['attendance', 'timetable', 'results', 'arrears', 'resume matching', 'campus', 'college'],
  authors: [{ name: 'CampusIQ' }],
  openGraph: {
    title: 'CampusIQ — Intelligent Solutions for a Smarter Campus',
    description: 'Attendance, timetables, academics, results and career readiness in one place.',
    siteName: 'CampusIQ',
    type: 'website',
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f6f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d11' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the persisted theme before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-fg"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
