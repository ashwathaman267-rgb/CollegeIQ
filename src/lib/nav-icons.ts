'use client';

import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  Circle,
  ClipboardCheck,
  DoorOpen,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * The server sends navigation with icon *names* (functions cannot cross the
 * JSON boundary); this registry turns a name back into a component.
 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  DoorOpen,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCog,
  Users,
  Circle,
};

export const navIcon = (name?: string | null): LucideIcon => (name && NAV_ICONS[name]) || Circle;
