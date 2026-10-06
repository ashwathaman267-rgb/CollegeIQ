import { z } from 'zod';

import { apiHandler, ok } from '@/server/api/handler';
import { createAcademicYear, listAcademicYears, setCurrentAcademicYear } from '@/server/services/people.service';
import { academicYearSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => ok(await listAcademicYears()));

/** Create an academic year, or flag an existing one as current. */
export const POST = apiHandler(async ({ body, user }) => {
  const { id } = z.object({ id: z.string().min(1).optional() }).parse(body ?? {});
  if (id) return ok(await setCurrentAcademicYear(id, user.id));
  return ok(await createAcademicYear(academicYearSchema.parse(body), user.id));
}, { roles: ['ADMIN'] });
