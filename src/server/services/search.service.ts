import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import type { AuthenticatedUser } from '@/server/auth/session';
import { can, canAny } from '@/lib/permissions';
import { navigationFor } from '@/lib/navigation';

export interface SearchGroup {
  label: string;
  items: { id: string; title: string; subtitle?: string; href: string; badge?: string }[];
}

/**
 * Global search across people, academics and pages, scoped by role.
 * Students never see other students' records or admin surfaces.
 */
export async function globalSearch(query: string, user: AuthenticatedUser): Promise<SearchGroup[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const mode: Prisma.QueryMode = 'insensitive';
  const groups: SearchGroup[] = [];
  const canSeePeople = canAny(user.role, ['students.manage', 'attendance.viewAll']);
  const take = 5;
  const needle = term.toLowerCase();

  const pageMatches = navigationFor(user.role)
    .flatMap((group) => group.items.map((item) => ({ item, group: group.label })))
    .filter(({ item }) => item.label.toLowerCase().includes(needle))
    .slice(0, 5)
    .map(({ item, group }) => ({ id: item.href, title: item.label, subtitle: group, href: item.href }));
  if (pageMatches.length) groups.push({ label: 'Pages', items: pageMatches });

  if (canSeePeople) {
    const students = await prisma.student.findMany({
      where: {
        deletedAt: null,
        OR: [
          { registerNumber: { contains: term, mode } },
          { rollNumber: { contains: term, mode } },
          { user: { firstName: { contains: term, mode } } },
          { user: { lastName: { contains: term, mode } } },
          { user: { email: { contains: term, mode } } },
        ],
      },
      take,
      include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } }, department: { select: { code: true } } },
    });
    if (students.length) {
      groups.push({
        label: 'Students',
        items: students.map((s) => ({
          id: s.id,
          title: `${s.user.firstName} ${s.user.lastName}`,
          subtitle: `${s.registerNumber} · ${s.class?.name ?? s.department.code}`,
          href: `/students/${s.id}`,
          badge: 'Student',
        })),
      });
    }

    const faculty = await prisma.faculty.findMany({
      where: {
        deletedAt: null,
        OR: [
          { employeeId: { contains: term, mode } },
          { designation: { contains: term, mode } },
          { user: { firstName: { contains: term, mode } } },
          { user: { lastName: { contains: term, mode } } },
          { user: { email: { contains: term, mode } } },
        ],
      },
      take,
      include: { user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } },
    });
    if (faculty.length) {
      groups.push({
        label: 'Faculty',
        items: faculty.map((f) => ({
          id: f.id,
          title: `${f.user.firstName} ${f.user.lastName}`,
          subtitle: `${f.employeeId} · ${f.designation} · ${f.department.name}`,
          href: `/faculty`,
          badge: 'Faculty',
        })),
      });
    }
  }

  const subjects = await prisma.subject.findMany({
    where: { deletedAt: null, OR: [{ code: { contains: term, mode } }, { name: { contains: term, mode } }] },
    take,
    include: { department: { select: { code: true } } },
  });
  if (subjects.length) {
    groups.push({
      label: 'Subjects',
      items: subjects.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: `${s.code} · Semester ${s.semester} · ${s.department.code}`,
        href: can(user.role, 'subjects.manage') ? '/subjects' : '/academics',
        badge: s.subjectType === 'LABORATORY' ? 'Lab' : s.subjectType === 'ELECTIVE' ? 'Elective' : 'Theory',
      })),
    });
  }

  if (canSeePeople) {
    const classes = await prisma.class.findMany({
      where: { deletedAt: null, OR: [{ name: { contains: term, mode } }, { section: { contains: term, mode } }] },
      take,
      include: { department: { select: { code: true } } },
    });
    if (classes.length) {
      groups.push({
        label: 'Classes',
        items: classes.map((c) => ({
          id: c.id,
          title: c.name,
          subtitle: `${c.department.code} · Semester ${c.semester}`,
          href: '/classes',
        })),
      });
    }
  }

  if (user.role !== 'STUDENT') {
    const results = await prisma.universityResult.findMany({
      where: { deletedAt: null, OR: [{ name: { contains: term, mode } }] },
      take: 3,
      select: { id: true, name: true, semester: true },
    });
    if (results.length) {
      groups.push({
        label: 'Results',
        items: results.map((r) => ({ id: r.id, title: r.name, subtitle: `Semester ${r.semester}`, href: `/results/${r.id}` })),
      });
    }
  }

  if (user.role === 'STUDENT' && user.studentId) {
    const jobs = await prisma.jobDescription.findMany({
      where: {
        deletedAt: null,
        OR: [
          { title: { contains: term, mode } },
          { company: { contains: term, mode } },
          { studentId: user.studentId },
        ],
      },
      take: 3,
      select: { id: true, title: true, company: true },
    });
    if (jobs.length) {
      groups.push({
        label: 'Jobs',
        items: jobs.map((j) => ({ id: j.id, title: j.title, subtitle: j.company ?? undefined, href: '/career' })),
      });
    }
  }

  return groups;
}
