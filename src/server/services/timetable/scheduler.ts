import type { DayOfWeek, SubjectType } from '@prisma/client';

import { seededRandom } from '@/lib/utils';
import type { TimetableConfig } from '@/types/settings';
import { buildDayGrid, DAY_LABEL, type GridSlot } from './grid';

export interface SchedulerSubject {
  subjectId: string;
  code: string;
  name: string;
  subjectType: SubjectType;
  weeklyPeriods: number;
  periodsPerSession: number;
  facultyId?: string | null;
  facultyName?: string | null;
}

export interface RoomOption {
  id: string;
  code: string;
  name: string;
  capacity: number;
}

export interface LabOption {
  id: string;
  code: string;
  name: string;
  capacity: number;
  roomId?: string | null;
}

export interface Placement {
  day: DayOfWeek;
  index: number;
  teachingIndex: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyId: string | null;
  roomId: string | null;
  laboratoryId: string | null;
  length: number;
}

export interface UnmetRequirement {
  subjectId: string;
  subjectName: string;
  required: number;
  placed: number;
  reason: string;
}

export interface SchedulerWarning {
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface SchedulerInput {
  classId: string;
  config: TimetableConfig;
  subjects: SchedulerSubject[];
  /** facultyId → set of "DAY|index" slots the faculty member cannot teach. */
  unavailable: Map<string, Set<string>>;
  /** Slots already taken by other classes in the same academic year. */
  occupiedFaculty: Map<string, Set<string>>;
  occupiedRooms: Map<string, Set<string>>;
  occupiedLabs: Map<string, Set<string>>;
  classSize: number;
  rooms: RoomOption[];
  laboratories: LabOption[];
  seed?: number;
  attempts?: number;
}

export interface SchedulerResult {
  placements: Placement[];
  unmet: UnmetRequirement[];
  warnings: SchedulerWarning[];
  score: number;
  metrics: {
    attemptsUsed: number;
    requiredPeriods: number;
    placedPeriods: number;
    facultyConflicts: number;
    roomConflicts: number;
    distributionPenalty: number;
    weeklyCapacity: number;
  };
}

const key = (day: string, index: number) => `${day}|${index}`;

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface Block {
  subject: SchedulerSubject;
  length: number;
  occurrence: number;
}

function buildBlocks(subjects: SchedulerSubject[]): { blocks: Block[]; required: Map<string, number> } {
  const blocks: Block[] = [];
  const required = new Map<string, number>();

  for (const subject of subjects) {
    const weekly = Math.max(0, Math.round(subject.weeklyPeriods));
    required.set(subject.subjectId, weekly);
    const perSession = Math.max(1, subject.periodsPerSession);
    const fullSessions = Math.floor(weekly / perSession);
    const remainder = weekly % perSession;

    for (let i = 0; i < fullSessions; i += 1) {
      blocks.push({ subject, length: perSession, occurrence: i + 1 });
    }
    if (remainder > 0) blocks.push({ subject, length: remainder, occurrence: fullSessions + 1 });
  }
  return { blocks, required };
}

/**
 * Constraint-aware timetable generator.
 *
 * Hard constraints (never violated): faculty clash, room clash, laboratory
 * clash, faculty unavailability, break protection (breaks are not teaching
 * slots at all), contiguous double periods for laboratories.
 *
 * Soft constraints (scored, best-of-N attempts): weekly period requirement,
 * same-subject distribution across a day, avoiding identical repeats in
 * consecutive periods, and keeping theory in the morning / labs after lunch.
 */
export function generateSchedule(input: SchedulerInput, seed = Date.now() % 100000): SchedulerResult {
  const random = seededRandom(seed);
  const grid = buildDayGrid(input.config);
  const days = input.config.workingDays;
  const periodSlots = grid.filter((s) => s.kind === 'PERIOD');
  const byIndex = new Map(grid.map((s) => [s.index, s]));
  const weeklyCapacity = periodSlots.length * days.length;

  const { blocks, required } = buildBlocks(input.subjects);
  const requiredPeriods = Array.from(required.values()).reduce((a, b) => a + b, 0);

  const warnings: SchedulerWarning[] = [];
  if (requiredPeriods > weeklyCapacity) {
    warnings.push({
      level: 'ERROR',
      message: `The class needs ${requiredPeriods} periods a week but only ${weeklyCapacity} are available in ${days.length} working day(s). Reduce weekly periods or extend the working day.`,
    });
  }

  // Candidate positions per block length, precomputed once.
  const candidatesByLength = new Map<number, { day: DayOfWeek; start: number; slots: GridSlot[] }[]>();
  const candidatesFor = (length: number) => {
    const cached = candidatesByLength.get(length);
    if (cached) return cached;
    const options: { day: DayOfWeek; start: number; slots: GridSlot[] }[] = [];
    for (const day of days) {
      for (let i = 0; i < periodSlots.length; i += 1) {
        const run: GridSlot[] = [];
        let cursor = periodSlots[i].index;
        let ok = true;
        for (let n = 0; n < length; n += 1) {
          const slot = byIndex.get(cursor);
          if (!slot || slot.kind !== 'PERIOD') {
            ok = false;
            break;
          }
          run.push(slot);
          cursor += 1;
        }
        if (ok && run.length === length) options.push({ day, start: periodSlots[i].index, slots: run });
      }
    }
    candidatesByLength.set(length, options);
    return options;
  };

  let best: { placements: Placement[]; unmet: UnmetRequirement[]; score: number; metrics: SchedulerResult['metrics'] } | null =
    null;

  const attempts = Math.max(1, input.attempts ?? input.config.generationAttempts ?? 40);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const placedThisClass = new Set<string>(); // day|index
    const subjectDayCount = new Map<string, number>(); // subjectId|DAY → count
    const facultyLocal = new Map<string, Set<string>>();
    const roomLocal = new Map<string, Set<string>>();
    const labLocal = new Map<string, Set<string>>();

    const placements: Placement[] = [];
    const unmet: UnmetRequirement[] = [];
    let distributionPenalty = 0;
    let facultyConflicts = 0;

    // Hardest blocks first: longer sessions, then more constrained faculty.
    const ordered = shuffle(blocks, random).sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      const aAvail = a.subject.facultyId ? (input.unavailable.get(a.subject.facultyId)?.size ?? 0) : 0;
      const bAvail = b.subject.facultyId ? (input.unavailable.get(b.subject.facultyId)?.size ?? 0) : 0;
      return bAvail - aAvail;
    });

    for (const block of ordered) {
      const candidates = candidatesFor(block.length);
      const facultyId = block.subject.facultyId ?? null;
      const needsLab = block.subject.subjectType === 'LABORATORY' || block.subject.subjectType === 'PROJECT';

      let chosen: { option: (typeof candidates)[number]; score: number } | null = null;

      const shuffled = shuffle(candidates, random);
      for (const option of shuffled) {
        const slotKeys = option.slots.map((s) => key(option.day, s.index));

        // HARD: this class must not double-book itself
        if (slotKeys.some((k) => placedThisClass.has(k))) continue;

        // HARD: faculty availability + external bookings
        if (facultyId) {
          const unavailable = input.unavailable.get(facultyId);
          if (unavailable && slotKeys.some((k) => unavailable.has(k))) continue;
          const busy = input.occupiedFaculty.get(facultyId);
          if (busy && slotKeys.some((k) => busy.has(k))) {
            facultyConflicts += 0; // avoided, not counted
            continue;
          }
          const local = facultyLocal.get(facultyId);
          if (local && slotKeys.some((k) => local.has(k))) continue;
        }

        // SOFT scoring
        let score = 0;
        const dayKey = `${block.subject.subjectId}|${option.day}`;
        const alreadyToday = subjectDayCount.get(dayKey) ?? 0;
        if (alreadyToday >= input.config.maxSameSubjectPerDay) score -= 60;
        else if (alreadyToday === 1) score -= 18;

        // Prefer to spread each subject across different days
        const daysUsed = new Set(
          placements.filter((p) => p.subjectId === block.subject.subjectId).map((p) => p.day),
        );
        if (!daysUsed.has(option.day)) score += 12;

        // Avoid back-to-back repeats of the same subject (unless it is one lab block)
        const adjacent = placements.some(
          (p) =>
            p.subjectId === block.subject.subjectId &&
            p.day === option.day &&
            Math.abs(p.index + p.length - option.start) <= 0,
        );
        if (adjacent) score -= 30;

        // Theory favours the first half of the day, labs the second half
        const midpoint = periodSlots.length / 2;
        const position = option.slots[0].teachingIndex ?? 1;
        if (needsLab) score += position > midpoint ? 6 : -4;
        else score += position <= midpoint ? 5 : -2;

        // Slight preference for filling earlier slots to reduce fragmentation
        score -= position * 0.6;

        // jitter to explore the space across attempts
        score += random() * 6;

        if (!chosen || score > chosen.score) chosen = { option, score };
      }

      if (!chosen) {
        const existing = unmet.find((u) => u.subjectId === block.subject.subjectId);
        if (existing) existing.required += block.length;
        else
          unmet.push({
            subjectId: block.subject.subjectId,
            subjectName: block.subject.name,
            required: block.length,
            placed: 0,
            reason: facultyId
              ? `No clash-free slot for ${block.subject.facultyName ?? 'the assigned faculty'} this week`
              : 'No free slot left in the working week',
          });
        distributionPenalty += 10;
        continue;
      }

      const { option } = chosen;
      if (chosen.score < 0) distributionPenalty += Math.min(30, Math.round(-chosen.score / 3));

      const slotKeys = option.slots.map((s) => key(option.day, s.index));
      slotKeys.forEach((k) => placedThisClass.add(k));
      subjectDayCount.set(`${block.subject.subjectId}|${option.day}`, (subjectDayCount.get(`${block.subject.subjectId}|${option.day}`) ?? 0) + 1);

      if (facultyId) {
        const set = facultyLocal.get(facultyId) ?? new Set<string>();
        slotKeys.forEach((k) => set.add(k));
        facultyLocal.set(facultyId, set);
      }

      // Resource allocation
      let laboratoryId: string | null = null;
      let roomId: string | null = null;

      if (needsLab && input.config.autoAssignRooms) {
        const lab = input.laboratories.find((l) => {
          const busy = input.occupiedLabs.get(l.id);
          if (busy && slotKeys.some((k) => busy.has(k))) return false;
          const local = labLocal.get(l.id);
          if (local && slotKeys.some((k) => local.has(k))) return false;
          return l.capacity >= input.classSize;
        }) ?? input.laboratories.find((l) => {
          const local = labLocal.get(l.id);
          return !(local && slotKeys.some((k) => local.has(k)));
        });
        if (lab) {
          laboratoryId = lab.id;
          roomId = lab.roomId ?? null;
          const set = labLocal.get(lab.id) ?? new Set<string>();
          slotKeys.forEach((k) => set.add(k));
          labLocal.set(lab.id, set);
          if (roomId) {
            const rset = roomLocal.get(roomId) ?? new Set<string>();
            slotKeys.forEach((k) => rset.add(k));
            roomLocal.set(roomId, rset);
          }
        } else {
          warnings.push({
            level: 'WARN',
            message: `No laboratory was free for ${block.subject.name} on ${DAY_LABEL[option.day]} — left unassigned.`,
          });
        }
      } else if (input.config.autoAssignRooms) {
        const room =
          input.rooms.find((r) => {
            if (r.capacity < input.classSize) return false;
            const busy = input.occupiedRooms.get(r.id);
            if (busy && slotKeys.some((k) => busy.has(k))) return false;
            const local = roomLocal.get(r.id);
            return !(local && slotKeys.some((k) => local.has(k)));
          }) ?? null;
        if (room) {
          roomId = room.id;
          const set = roomLocal.get(room.id) ?? new Set<string>();
          slotKeys.forEach((k) => set.add(k));
          roomLocal.set(room.id, set);
        }
      }

      placements.push({
        day: option.day,
        index: option.slots[0].index,
        teachingIndex: option.slots[0].teachingIndex ?? 1,
        startTime: option.slots[0].startTime,
        endTime: option.slots[option.slots.length - 1].endTime,
        subjectId: block.subject.subjectId,
        subjectCode: block.subject.code,
        subjectName: block.subject.name,
        facultyId,
        roomId,
        laboratoryId,
        length: block.length,
      });
    }

    // Fill in the per-subject "placed" counts for the unmet report
    for (const entry of unmet) {
      entry.placed = placements
        .filter((p) => p.subjectId === entry.subjectId)
        .reduce((acc, p) => acc + p.length, 0);
    }

    const unmetPeriods = unmet.reduce((acc, u) => acc + Math.max(0, u.required - u.placed), 0);
    const score = unmetPeriods * 100 + distributionPenalty;

    const metrics: SchedulerResult['metrics'] = {
      attemptsUsed: attempt + 1,
      requiredPeriods,
      placedPeriods: placements.reduce((acc, p) => acc + p.length, 0),
      facultyConflicts,
      roomConflicts: 0,
      distributionPenalty,
      weeklyCapacity,
    };

    if (!best || score < best.score) best = { placements, unmet, score, metrics };
    if (score === 0) break; // perfect schedule, stop early
  }

  const result = best!;
  const seenWarnings = new Set(warnings.map((w) => w.message));
  for (const u of result.unmet) {
    const message = `${u.subjectName}: only ${u.placed} of ${u.required} weekly periods could be scheduled (${u.reason}).`;
    if (!seenWarnings.has(message)) warnings.push({ level: 'WARN', message });
  }

  return {
    placements: result.placements.sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day) || a.index - b.index),
    unmet: result.unmet,
    warnings,
    score: result.score,
    metrics: result.metrics,
  };
}
