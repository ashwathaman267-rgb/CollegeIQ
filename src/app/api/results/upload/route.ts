import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { processResultUpload } from '@/server/services/results.service';
import { resultUploadSchema } from '@/validations';
import { badRequest, unsupportedMedia } from '@/server/api/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function toBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

export const POST = apiHandler(async ({ request, user }) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) throw unsupportedMedia('Upload the result sheet as a file.');

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Choose a result sheet file to upload.');

  const meta = resultUploadSchema.parse({
    name: form.get('name') ?? undefined,
    semester: form.get('semester') || undefined,
    declaredOn: form.get('declaredOn') || undefined,
    departmentId: form.get('departmentId') || undefined,
    classId: form.get('classId') || undefined,
    academicYearId: form.get('academicYearId') || undefined,
  });

  const result = await processResultUpload(
    {
      buffer: await toBuffer(file),
      mimeType: file.type || 'application/octet-stream',
      filename: file.name,
      sizeBytes: file.size,
      ...meta,
    },
    { userId: user.id, facultyId: user.facultyId },
  );
  return ok(result);
}, { roles: ['ADMIN', 'FACULTY'], rateLimit: RATE_LIMITS.upload });
