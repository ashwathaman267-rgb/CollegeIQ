import { NextResponse } from 'next/server';

import { apiHandler } from '@/server/api/handler';
import { downloadAsset } from '@/server/services/career.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params }) => {
  const asset = await downloadAsset(params.id);
  return new NextResponse(new Uint8Array(asset.buffer), {
    headers: {
      'content-type': asset.mimeType,
      'content-disposition': `attachment; filename="${asset.filename}"`,
      'cache-control': 'no-store',
    },
  });
});
