import { Suspense } from 'react';
import type { Metadata } from 'next';

import { requireUser } from '@/server/auth/guards';
import { AcademicsView } from '@/features/academics/academics-view';
import { SkeletonTiles } from '@/components/ui/states';

export const metadata: Metadata = { title: 'Academics' };
export const dynamic = 'force-dynamic';

export default async function AcademicsPage() {
  await requireUser('/academics');
  return (
    <Suspense fallback={<SkeletonTiles count={4} />}>
      <AcademicsView />
    </Suspense>
  );
}
