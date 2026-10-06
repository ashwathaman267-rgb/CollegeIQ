import { NextResponse } from 'next/server';

import { apiHandler } from '@/server/api/handler';
import { exportTimetable } from '@/server/services/timetable.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params, searchParams }) => {
  const format = searchParams.get('format') === 'ics' ? 'ics' : 'csv';
  const file = await exportTimetable(params.id, format);
  return new NextResponse(file.content, {
    headers: {
      'content-type': `${file.mime}; charset=utf-8`,
      'content-disposition': `attachment; filename="${file.filename}"`,
      'cache-control': 'no-store',
    },
  });
});
