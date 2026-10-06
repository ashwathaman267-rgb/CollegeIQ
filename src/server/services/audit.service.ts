import { prisma } from '@/lib/db';

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  description: string;
  previousValue?: unknown;
  newValue?: unknown;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Append-only trail of administrative activity.
 * Never throws — an audit failure must not break the user-facing operation.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        description: entry.description.slice(0, 500),
        previousValue: entry.previousValue === undefined ? undefined : (entry.previousValue as object),
        newValue: entry.newValue === undefined ? undefined : (entry.newValue as object),
        userId: entry.userId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to record entry', entry.action, err);
  }
}

/** Fire-and-forget variant for hot paths. */
export function audit(entry: AuditEntry) {
  void recordAudit(entry);
}

export interface AuditQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  resourceType?: string;
  action?: string;
  userId?: string;
  from?: Date;
  to?: Date;
}

export async function listAuditLogs(query: AuditQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));

  const where = {
    ...(query.resourceType ? { resourceType: query.resourceType } : {}),
    ...(query.action ? { action: { contains: query.action, mode: 'insensitive' as const } } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.from || query.to
      ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { description: { contains: query.search, mode: 'insensitive' as const } },
            { action: { contains: query.search, mode: 'insensitive' as const } },
            { resourceType: { contains: query.search, mode: 'insensitive' as const } },
            { user: { firstName: { contains: query.search, mode: 'insensitive' as const } } },
            { user: { lastName: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
    }),
  ]);

  return {
    items,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function auditFacets() {
  const [resourceTypes, actions] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ['resourceType'],
      select: { resourceType: true },
      orderBy: { resourceType: 'asc' },
    }),
    prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
      take: 100,
    }),
  ]);
  return {
    resourceTypes: resourceTypes.map((r) => r.resourceType),
    actions: actions.map((a) => a.action),
  };
}
