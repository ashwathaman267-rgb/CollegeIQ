import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { AuthShell } from '@/components/auth/auth-shell';
import { RegisterForm } from '@/features/auth/register-form';

export const metadata: Metadata = { title: 'Create account' };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  });

  return (
    <AuthShell
      title="Create your student account"
      subtitle="Register with your college register number. Your class and subjects are assigned by your department office."
    >
      <RegisterForm departments={departments} />
    </AuthShell>
  );
}
