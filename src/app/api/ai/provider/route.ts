import { apiHandler, ok } from '@/server/api/handler';
import { describeAiProvider } from '@/lib/ai';
import { syncSkillTaxonomy } from '@/server/services/career.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => ok({ provider: describeAiProvider(), skills: await syncSkillTaxonomy() }));
