import type { Metadata } from 'next';

import { requireUser } from '@/server/auth/guards';
import { CareerView } from '@/features/career/career-view';

export const metadata: Metadata = { title: 'Career' };
export const dynamic = 'force-dynamic';

export default async function CareerPage() {
  await requireUser('/career');
  return <CareerView />;
}
