import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { createJobDescription, listJobDescriptions } from '@/server/services/career.service';
import { badRequest, unsupportedMedia } from '@/server/api/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = apiHandler(async ({ searchParams, user }) => {
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
  const result = await listJobDescriptions({
    studentId: user.studentId ?? undefined,
    search: searchParams.get('search') ?? undefined,
    page,
  });
  return ok(result.items, result.meta);
}, { roles: ['STUDENT'] });

export const POST = apiHandler(async ({ request, user }) => {
  const contentType = request.headers.get('content-type') ?? '';
  let payload: Record<string, string | undefined> = {};
  let file: { buffer: Buffer; mimeType: string; filename: string; sizeBytes: number } | undefined;

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    payload = {
      title: (form.get('title') as string) || undefined,
      company: (form.get('company') as string) || undefined,
      location: (form.get('location') as string) || undefined,
      jobType: (form.get('jobType') as string) || undefined,
      sourceUrl: (form.get('sourceUrl') as string) || undefined,
      description: (form.get('description') as string) || undefined,
    };
    const upload = form.get('file');
    if (upload instanceof File && upload.size > 0) {
      file = {
        buffer: Buffer.from(await upload.arrayBuffer()),
        mimeType: upload.type || 'application/octet-stream',
        filename: upload.name,
        sizeBytes: upload.size,
      };
    }
  } else {
    payload = (await request.json()) as Record<string, string>;
  }

  if (!file && !(payload.description ?? '').trim()) {
    throw unsupportedMedia('Paste the job description text or upload a file.');
  }

  return ok(
    await createJobDescription(
      { ...payload, jobType: payload.jobType as never, studentId: user.studentId ?? undefined, file },
      user.id,
    ),
  );
}, { roles: ['STUDENT'], rateLimit: RATE_LIMITS.ai });
