import type { Metadata } from 'next';

import { requireRole } from '@/server/auth/guards';
import { ResultDetail } from '@/features/results/result-detail';

export const metadata: Metadata = { title: 'Result report' };
export const dynamic = 'force-dynamic';

export default async function ResultDetailPage({ params }: { params: { id: string } }) {
  // Individual result reports are an institutional view: students read their own
  // record from /results instead.
  await requireRole(['ADMIN', 'FACULTY'], `/results/${params.id}`);
  return <ResultDetail resultId={params.id} />;
}
