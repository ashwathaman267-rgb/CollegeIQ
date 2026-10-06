import type { Metadata } from 'next';

import { requireRole } from '@/server/auth/guards';
import { RoomsView } from '@/features/structure/rooms-view';

export const metadata: Metadata = { title: 'Rooms & Labs' };
export const dynamic = 'force-dynamic';

export default async function RoomsViewPage() {
  await requireRole(['ADMIN', 'FACULTY'], '/rooms');
  return <RoomsView />;
}
