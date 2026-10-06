import {
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
} from 'lucide-react';
import type { Role } from '@prisma/client';
import { can, type Capability } from './permissions';

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  capability?: Capability;
  /** Match exactly, or match any nested route (default). */
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const STUDENT_NAV: NavGroup[] = [
  {
    label: 'My Campus',
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Attendance', href: '/attendance', icon: ClipboardCheck },
      { label: 'Timetable', href: '/timetable', icon: CalendarDays },
      { label: 'Academics', href: '/academics', icon: BookOpen },
      { label: 'Results', href: '/results', icon: Trophy },
      { label: 'Career', href: '/career', icon: Sparkles },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Profile', href: '/profile', icon: GraduationCap },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

const FACULTY_NAV: NavGroup[] = [
  {
    label: 'Teaching',
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Attendance', href: '/attendance', icon: ClipboardCheck },
      { label: 'Academics', href: '/academics', icon: BookOpen },
      { label: 'Results', href: '/results', icon: Trophy },
      { label: 'Timetable', href: '/timetable', icon: CalendarDays },
    ],
  },
  {
    label: 'People',
    items: [{ label: 'Students', href: '/students', icon: Users }],
  },
  {
    label: 'Account',
    items: [
      { label: 'Profile', href: '/profile', icon: GraduationCap },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Institution',
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Analytics', href: '/analytics', icon: BarChart3, capability: 'analytics.view' },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Students', href: '/students', icon: Users, capability: 'students.manage' },
      { label: 'Faculty', href: '/faculty', icon: UserCog, capability: 'faculty.manage' },
    ],
  },
  {
    label: 'Academic structure',
    items: [
      { label: 'Departments', href: '/departments', icon: Building2, capability: 'departments.manage' },
      { label: 'Subjects', href: '/subjects', icon: Library, capability: 'subjects.manage' },
      { label: 'Classes', href: '/classes', icon: CalendarRange, capability: 'classes.manage' },
      { label: 'Rooms & Labs', href: '/rooms', icon: DoorOpen, capability: 'rooms.manage' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Attendance', href: '/attendance', icon: ClipboardCheck },
      { label: 'Academics', href: '/academics', icon: BookOpen },
      { label: 'Results', href: '/results', icon: Trophy },
      { label: 'Timetable', href: '/timetable', icon: CalendarDays },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings, capability: 'settings.manage' },
      { label: 'Audit logs', href: '/audit-logs', icon: ScrollText, capability: 'audit.view' },
    ],
  },
];

export function navigationFor(role: Role): NavGroup[] {
  const groups = role === 'ADMIN' ? ADMIN_NAV : role === 'FACULTY' ? FACULTY_NAV : STUDENT_NAV;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.capability || can(role, item.capability)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Compact bottom navigation for phones. */
export function mobileNavFor(role: Role): NavItem[] {
  const all = navigationFor(role).flatMap((g) => g.items);
  const priority: Record<Role, string[]> = {
    STUDENT: ['/dashboard', '/attendance', '/timetable', '/academics', '/career'],
    FACULTY: ['/dashboard', '/attendance', '/academics', '/students', '/timetable'],
    ADMIN: ['/dashboard', '/students', '/attendance', '/analytics', '/settings'],
  };
  const ordered = priority[role]
    .map((href) => all.find((i) => i.href === href))
    .filter((i): i is NavItem => Boolean(i));
  return ordered.slice(0, 5);
}

export const MODULE_META: Record<string, { title: string; description: string; icon: typeof Activity }> = {
  '/dashboard': {
    title: 'Overview',
    description: 'What needs your attention today',
    icon: LayoutDashboard,
  },
  '/attendance': {
    title: 'Attendance',
    description: 'Track, record and analyse class attendance',
    icon: ClipboardCheck,
  },
  '/timetable': {
    title: 'Timetable',
    description: 'Conflict-free weekly schedules',
    icon: CalendarDays,
  },
  '/academics': {
    title: 'Academics',
    description: 'Internal assessment performance',
    icon: BookOpen,
  },
  '/results': {
    title: 'Results',
    description: 'University results, arrears and pass percentage',
    icon: Trophy,
  },
  '/career': {
    title: 'Career',
    description: 'Resume–job alignment and skill gaps',
    icon: Sparkles,
  },
  '/students': { title: 'Students', description: 'Student records', icon: Users },
  '/faculty': { title: 'Faculty', description: 'Faculty records', icon: UserCog },
  '/departments': { title: 'Departments', description: 'Academic departments', icon: Building2 },
  '/subjects': { title: 'Subjects', description: 'Course catalogue', icon: Library },
  '/classes': { title: 'Classes', description: 'Cohorts, years and sections', icon: CalendarRange },
  '/rooms': { title: 'Rooms & Labs', description: 'Physical teaching resources', icon: DoorOpen },
  '/analytics': { title: 'Analytics', description: 'Institution-wide insight', icon: BarChart3 },
  '/audit-logs': { title: 'Audit logs', description: 'Administrative activity trail', icon: ScrollText },
  '/settings': { title: 'Settings', description: 'Institutional configuration', icon: Settings },
  '/profile': { title: 'Profile', description: 'Your account', icon: GraduationCap },
  '/notifications': { title: 'Notifications', description: 'Recent alerts', icon: FileText },
};

export const GUARD_ICON = ShieldCheck;

// ─────────────────────────────────────────────────────────────────────────
// JSON-safe navigation (icons travel as names, resolved on the client)
// ─────────────────────────────────────────────────────────────────────────

const ICON_NAMES = new Map<unknown, string>([
  [Activity, 'Activity'],
  [BarChart3, 'BarChart3'],
  [BookOpen, 'BookOpen'],
  [Building2, 'Building2'],
  [CalendarDays, 'CalendarDays'],
  [CalendarRange, 'CalendarRange'],
  [ClipboardCheck, 'ClipboardCheck'],
  [DoorOpen, 'DoorOpen'],
  [FileText, 'FileText'],
  [GraduationCap, 'GraduationCap'],
  [LayoutDashboard, 'LayoutDashboard'],
  [Library, 'Library'],
  [ScrollText, 'ScrollText'],
  [Settings, 'Settings'],
  [ShieldCheck, 'ShieldCheck'],
  [Sparkles, 'Sparkles'],
  [Trophy, 'Trophy'],
  [UserCog, 'UserCog'],
  [Users, 'Users'],
]);

export const iconName = (icon: unknown): string => ICON_NAMES.get(icon) ?? 'Circle';

export interface NavItemDto {
  label: string;
  href: string;
  icon: string;
  capability?: string;
  exact?: boolean;
}

export interface NavGroupDto {
  label: string;
  items: NavItemDto[];
}

const toDto = (item: NavItem): NavItemDto => ({
  label: item.label,
  href: item.href,
  icon: iconName(item.icon),
  ...(item.capability ? { capability: item.capability } : {}),
  ...(item.exact ? { exact: true } : {}),
});

export function navigationDtoFor(role: Role): NavGroupDto[] {
  return navigationFor(role).map((group) => ({ label: group.label, items: group.items.map(toDto) }));
}

export function mobileNavDtoFor(role: Role): NavItemDto[] {
  return mobileNavFor(role).map(toDto);
}

/** Breadcrumb + header metadata for a route, JSON-safe. */
export function moduleMetaFor(pathname: string) {
  const key = Object.keys(MODULE_META)
    .filter((key) => pathname === key || pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (!key) return null;
  const meta = MODULE_META[key];
  return { href: key, title: meta.title, description: meta.description, icon: iconName(meta.icon) };
}
