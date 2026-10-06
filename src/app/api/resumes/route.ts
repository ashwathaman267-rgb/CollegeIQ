import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { createResume, listResumes } from '@/server/services/career.service';
import { badRequest, unsupportedMedia } from '@/server/api/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = apiHandler(async ({ user }) => {
  if (!user.studentId) throw badRequest('A student profile is required to manage resumes.');
  return ok(await listResumes(user.studentId));
}, { roles: ['STUDENT'] });

export const POST = apiHandler(async ({ request, user }) => {
  if (!user.studentId) throw badRequest('A student profile is required to upload a resume.');

  const contentType = request.headers.get('content-type') ?? '';
  let text: string | undefined;
  let title: string | undefined;
  let file: { buffer: Buffer; mimeType: string; filename: string; sizeBytes: number } | undefined;

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    text = (form.get('text') as string) || undefined;
    title = (form.get('title') as string) || undefined;
    const upload = form.get('file');
    if (upload instanceof File && upload.size > 0) {
      file = {
        buffer: Buffer.from(await upload.arrayBuffer()),
        mimeType: upload.type || 'application/octet-stream',
        filename: upload.name,
        sizeBytes: upload.size,
      };
    }
    if (!file && !text) throw badRequest('Upload a resume file or paste your resume text.');
  } else {
    const body = (await request.json()) as { text?: string; title?: string };
    text = body.text;
    title = body.title;
    if (!text) throw unsupportedMedia('Paste your resume text or upload a file.');
  }

  return ok(await createResume({ studentId: user.studentId, text, title, file }, user.id));
}, { roles: ['STUDENT'], rateLimit: RATE_LIMITS.ai });
