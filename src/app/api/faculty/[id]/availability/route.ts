import { apiHandler, ok } from '@/server/api/handler';
import { listFacultyAvailability, setFacultyAvailability } from '@/server/services/timetable.service';
import { availabilitySchema } from '@/validations';
import { forbidden } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params, user }) => {
  if (user.role === 'FACULTY' && user.facultyId !== params.id) throw forbidden();
  return ok(await listFacultyAvailability(params.id));
}, { roles: ['ADMIN', 'FACULTY'] });

export const PUT = apiHandler(async ({ params, body, user }) => {
  if (user.role === 'FACULTY' && user.facultyId !== params.id) throw forbidden();
  const { entries } = availabilitySchema.parse(body);
  return ok(await setFacultyAvailability(params.id, entries));
}, { roles: ['ADMIN', 'FACULTY'] });
