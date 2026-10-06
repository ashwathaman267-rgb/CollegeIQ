import { apiHandler, ok } from '@/server/api/handler';
import { getSettings, updateSettings, type SettingUpdate } from '@/server/services/settings.service';
import { settingsUpdateSchema } from '@/validations';
import { requestMeta } from '@/server/auth/session';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => ok(await getSettings()));

export const PATCH = apiHandler(async ({ body, user }) => {
  if (!can(user.role, 'settings.manage')) throw new Error('forbidden');
  const parsed = settingsUpdateSchema.parse(body);
  const updates: SettingUpdate[] = [];
  if (parsed.attendance) updates.push({ key: 'attendance', value: parsed.attendance });
  if (parsed.timetable) updates.push({ key: 'timetable', value: parsed.timetable });
  if (parsed.academic) updates.push({ key: 'academic', value: parsed.academic });
  if (parsed.institution) updates.push({ key: 'institution', value: parsed.institution });
  const meta = requestMeta();
  return ok(await updateSettings(updates, { id: user.id, ipAddress: meta.ip, userAgent: meta.userAgent }));
}, { roles: ['ADMIN'] });
