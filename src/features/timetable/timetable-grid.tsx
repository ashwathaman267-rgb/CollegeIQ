'use client';

import * as React from 'react';
import { Coffee, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatClock } from '@/lib/format';
import { chartColor } from '@/components/ui/charts';

export interface GridSlot {
  index: number;
  teachingIndex: number | null;
  kind: 'PERIOD' | 'BREAK';
  label: string;
  startTime: string;
  endTime: string;
}

export interface Cell {
  slotId: string;
  day: string;
  index: number;
  teachingIndex: number | null;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  label?: string;
  subjectId?: string | null;
  subjectCode?: string | null;
  subjectName?: string | null;
  subjectType?: string | null;
  facultyId?: string | null;
  facultyName?: string | null;
  roomId?: string | null;
  roomCode?: string | null;
  laboratoryId?: string | null;
  laboratoryName?: string | null;
  classId?: string | null;
  className?: string | null;
}

const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

/** Stable colour per subject so a week reads at a glance. */
function useSubjectColors(cells: Cell[]) {
  return React.useMemo(() => {
    const map = new Map<string, string>();
    const subjects = Array.from(new Set(cells.map((cell) => cell.subjectCode).filter(Boolean) as string[])).sort();
    subjects.forEach((code, index) => map.set(code, chartColor(index)));
    return map;
  }, [cells]);
}

export interface TimetableGridProps {
  grid: GridSlot[];
  days: string[];
  cells: Cell[];
  onCellClick?: (day: string, slot: GridSlot, cell?: Cell) => void;
  showClass?: boolean;
  showFaculty?: boolean;
  highlightToday?: boolean;
  className?: string;
  caption?: string;
}

/**
 * Weekly timetable grid: periods down the side, days across the top, with
 * configured breaks rendered as labelled rows so the day is self-explanatory.
 */
export function TimetableGrid({
  grid,
  days,
  cells,
  onCellClick,
  showClass,
  showFaculty = true,
  highlightToday = true,
  className,
  caption,
}: TimetableGridProps) {
  const colors = useSubjectColors(cells);
  const todayIndex = new Date().getUTCDay();
  const todayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][todayIndex];

  const byKey = React.useMemo(() => new Map(cells.map((cell) => [`${cell.day}|${cell.index}`, cell])), [cells]);

  if (!grid.length || !days.length) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted">
        No timetable grid is configured. Set period length and working hours in Settings.
      </p>
    );
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[46rem] border-collapse text-left">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 w-24 border-b border-r border-line bg-raised px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-subtle">
              Period
            </th>
            {days.map((day) => (
              <th
                key={day}
                scope="col"
                className={cn(
                  'border-b border-line bg-raised px-3 py-2 text-center text-2xs font-semibold uppercase tracking-wider',
                  highlightToday && day === todayName ? 'bg-brand-soft text-brand' : 'text-subtle',
                )}
              >
                {DAY_SHORT[day] ?? day.slice(0, 3)}
                {highlightToday && day === todayName ? <span className="ml-1 normal-case tracking-normal">(today)</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((slot) => {
            if (slot.kind === 'BREAK') {
              return (
                <tr key={`break-${slot.index}`} className="bg-raised/70">
                  <th scope="row" className="sticky left-0 z-10 border-y border-r border-line bg-raised px-3 py-1.5 text-left">
                    <span className="tnum block text-2xs font-semibold text-subtle">{formatClock(slot.startTime)}</span>
                  </th>
                  <td colSpan={days.length} className="border-y border-line px-3 py-1.5">
                    <span className="flex items-center justify-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.12em] text-subtle">
                      <Coffee className="h-3 w-3" aria-hidden />
                      {slot.label} · {formatClock(slot.startTime)}–{formatClock(slot.endTime)}
                    </span>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={`period-${slot.index}`} className="group/row">
                <th scope="row" className="sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-2 align-top group-hover/row:bg-raised">
                  <span className="tnum block text-[0.8125rem] font-semibold text-ink">P{slot.teachingIndex}</span>
                  <span className="tnum block text-2xs text-subtle">
                    {formatClock(slot.startTime)}–{formatClock(slot.endTime)}
                  </span>
                </th>
                {days.map((day) => {
                  const cell = byKey.get(`${day}|${slot.index}`);
                  const filled = Boolean(cell?.subjectId);
                  const color = cell?.subjectCode ? colors.get(cell.subjectCode) : undefined;
                  const interactive = Boolean(onCellClick);

                  return (
                    <td key={`${day}-${slot.index}`} className="border-b border-line p-1 align-top">
                      {interactive ? (
                        <button
                          type="button"
                          onClick={() => onCellClick?.(day, slot, cell)}
                          className={cn(
                            'relative flex h-full min-h-[3.75rem] w-full flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left transition-all duration-150',
                            filled ? 'border-transparent hover:-translate-y-px hover:shadow-card' : 'border-dashed border-line bg-transparent hover:border-brand/50 hover:bg-brand-soft/40',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45',
                          )}
                          style={filled && color ? { background: `color-mix(in srgb, ${color} 12%, transparent)`, borderLeft: `3px solid ${color}` } : undefined}
                          aria-label={
                            filled
                              ? `${DAY_SHORT[day] ?? day} period ${slot.teachingIndex}: ${cell?.subjectName} with ${cell?.facultyName ?? 'unassigned faculty'}`
                              : `${DAY_SHORT[day] ?? day} period ${slot.teachingIndex}: free — click to assign`
                          }
                        >
                          {filled ? (
                            <>
                              <span className="truncate text-[0.8125rem] font-semibold text-ink">{cell?.subjectCode}</span>
                              <span className="line-clamp-2 text-2xs leading-snug text-muted">{cell?.subjectName}</span>
                              {showFaculty && cell?.facultyName ? <span className="mt-auto truncate text-2xs text-subtle">{cell.facultyName}</span> : null}
                              {showClass && cell?.className ? <span className="truncate text-2xs text-subtle">{cell.className}</span> : null}
                              {cell?.laboratoryName || cell?.roomCode ? (
                                <span className="truncate text-2xs font-medium text-muted">{cell.laboratoryName ?? cell.roomCode}</span>
                              ) : null}
                            </>
                          ) : (
                            <span className="m-auto flex items-center gap-1 text-2xs font-medium text-subtle opacity-0 transition-opacity group-hover/row:opacity-100">
                              <Plus className="h-3 w-3" aria-hidden />
                              Assign
                            </span>
                          )}
                        </button>
                      ) : (
                        <div
                          className="flex min-h-[3.75rem] flex-col gap-0.5 rounded-md px-2 py-1.5"
                          style={filled && color ? { background: `color-mix(in srgb, ${color} 12%, transparent)`, borderLeft: `3px solid ${color}` } : undefined}
                        >
                          {filled ? (
                            <>
                              <span className="truncate text-[0.8125rem] font-semibold text-ink">{cell?.subjectCode}</span>
                              <span className="line-clamp-2 text-2xs leading-snug text-muted">{cell?.subjectName}</span>
                              {showFaculty && cell?.facultyName ? <span className="mt-auto truncate text-2xs text-subtle">{cell.facultyName}</span> : null}
                              {showClass && cell?.className ? <span className="truncate text-2xs text-subtle">{cell.className}</span> : null}
                              {cell?.laboratoryName || cell?.roomCode ? (
                                <span className="truncate text-2xs font-medium text-muted">{cell.laboratoryName ?? cell.roomCode}</span>
                              ) : null}
                            </>
                          ) : (
                            <span className="m-auto text-2xs text-subtle">Free</span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Colour key for the subjects shown in a grid. */
export function SubjectLegend({ cells }: { cells: Cell[] }) {
  const colors = useSubjectColors(cells);
  const entries = Array.from(colors.entries());
  if (!entries.length) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {entries.map(([code, color]) => {
        const cell = cells.find((c) => c.subjectCode === code);
        return (
          <li key={code} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden />
            <span className="font-semibold text-ink">{code}</span>
            {cell?.subjectName ? <span className="hidden truncate sm:inline">{cell.subjectName}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
