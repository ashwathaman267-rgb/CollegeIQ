import type { Metadata } from 'next';

import { requireUser } from '@/server/auth/guards';
import { MatchDetail } from '@/features/career/match-detail';

export const metadata: Metadata = { title: 'Alignment report' };
export const dynamic = 'force-dynamic';

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  // The API enforces ownership; the page only needs an authenticated session.
  await requireUser(`/career/matches/${params.id}`);
  return <MatchDetail matchId={params.id} />;
}
