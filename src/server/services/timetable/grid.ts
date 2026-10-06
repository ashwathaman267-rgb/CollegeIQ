import type { DayOfWeek } from '@prisma/client';

import type { BreakWindow, TimetableConfig } from '@/types/settings';

export interface GridSlot {
  /** Position in the day, 1-based. Breaks occupy a position too. */
  index: number;
  /** Ordinal teaching period (1..N); null for breaks. */
  teachingIndex: number | null;
  kind: 'PERIOD' | 'BREAK';
  label: string;
  startTime: string;
  endTime: string;
  minutes: number;
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fromMinutes = (total: number) => {
  const clamped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
};

export const DAY_LABEL: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

export const DAY_SHORT: Record<DayOfWeek, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

/**
 * Build one working day from the configured period length, working hours and
 * break windows.
 *
 * Breaks are authoritative: a period that would run into a break is shortened
 * down to `minPeriodMinutes`, and dropped entirely if it would be shorter than
 * that. With the shipped defaults (50-minute periods, breaks at 10:40, 12:35
 * and 14:50) this produces eight teaching periods between 09:00 and 16:40.
 */
export function buildDayGrid(config: TimetableConfig): GridSlot[] {
  const slots: GridSlot[] = [];
  const workStart = toMinutes(config.workStart);
  const workEnd = toMinutes(config.workEnd);
  const duration = Math.max(15, config.periodMinutes);
  const minimum = Math.min(config.minPeriodMinutes, duration);

  const breaks: { label: string; start: number; end: number }[] = config.breaks
    .map((b) => ({ ...b, start: toMinutes(b.start), end: toMinutes(b.end) }))
    .filter((b) => b.end > b.start && b.start >= workStart && b.end <= workEnd)
    .sort((a, b) => a.start - b.start);

  let cursor = workStart;
  let index = 1;
  let teaching = 1;

  const pushPeriod = (start: number, end: number) => {
    slots.push({
      index: index++,
      teachingIndex: teaching++,
      kind: 'PERIOD',
      label: `Period ${teaching - 1}`,
      startTime: fromMinutes(start),
      endTime: fromMinutes(end),
      minutes: end - start,
    });
  };

  for (const brk of breaks) {
    // Fill teaching time before this break.
    for (;;) {
      if (cursor + duration <= brk.start) {
        pushPeriod(cursor, cursor + duration);
        cursor += duration;
        continue;
      }
      const truncated = brk.start - cursor;
      if (truncated >= minimum) {
        pushPeriod(cursor, brk.start);
      }
      break;
    }
    if (brk.end > cursor) {
      slots.push({
        index: index++,
        teachingIndex: null,
        kind: 'BREAK',
        label: brk.label,
        startTime: fromMinutes(brk.start),
        endTime: fromMinutes(brk.end),
        minutes: brk.end - brk.start,
      });
      cursor = brk.end;
    }
  }

  for (;;) {
    if (cursor + duration <= workEnd) {
      pushPeriod(cursor, cursor + duration);
      cursor += duration;
      continue;
    }
    const truncated = workEnd - cursor;
    if (truncated >= minimum) pushPeriod(cursor, workEnd);
    break;
  }

  return slots;
}

export function teachingSlots(grid: GridSlot[]) {
  return grid.filter((s) => s.kind === 'PERIOD');
}

/** Weekly capacity: how many teaching slots exist for the configured days. */
export function weeklyCapacity(config: TimetableConfig) {
  return buildDayGrid(config).filter((s) => s.kind === 'PERIOD').length * config.workingDays.length;
}

export function gridLabel(slot: GridSlot) {
  return slot.kind === 'BREAK' ? slot.label : `${slot.label} · ${slot.startTime}–${slot.endTime}`;
}

/** Does a requested time range collide with a configured break? */
export function violatesBreak(config: TimetableConfig, start: string, end: string): BreakWindow | null {
  const s = toMinutes(start);
  const e = toMinutes(end);
  for (const brk of config.breaks) {
    if (overlaps(s, e, toMinutes(brk.start), toMinutes(brk.end))) return brk;
  }
  return null;
}

export function outsideWorkingHours(config: TimetableConfig, start: string, end: string) {
  return toMinutes(start) < toMinutes(config.workStart) || toMinutes(end) > toMinutes(config.workEnd);
}
