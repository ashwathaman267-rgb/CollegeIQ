import { requireUser } from '@/server/auth/guards';
import { getSettings } from '@/server/services/settings.service';
import { mobileNavDtoFor, navigationDtoFor } from '@/lib/navigation';
import { describeAiProvider } from '@/lib/ai';
import { AppShell } from '@/components/layout/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { institution } = await getSettings();

  return (
    <AppShell
      navigation={navigationDtoFor(user.role)}
      mobileNavigation={mobileNavDtoFor(user.role)}
      institution={institution}
      ai={describeAiProvider()}
    >
      {children}
    </AppShell>
  );
}
