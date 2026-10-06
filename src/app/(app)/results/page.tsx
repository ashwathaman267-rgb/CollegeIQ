import type { Metadata } from 'next';

import { requireUser } from '@/server/auth/guards';
import { ResultsView } from '@/features/results/results-view';

export const metadata: Metadata = { title: 'Results' };
export const dynamic = 'force-dynamic';

export default async function ResultsPage() {
  await requireUser('/results');
  return <ResultsView />;
}
