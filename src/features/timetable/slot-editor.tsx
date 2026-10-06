'use client';

import * as React from 'react';
import { Eraser, Save, Trash2 } from 'lucide-react';

import { api } from '@/lib/api-client';
import { useApi, useInvalidate } from '@/hooks/use-api';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/form';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import type { Cell, GridSlot } from './timetable-grid';

interface SubjectOption {
  id: string;
  code: string;
  name: string;
  subjectType: string;
  weeklyPeriods: number;
}
interface FacultyOption {
  id: string;
  name: string;
  employeeId: string;
  subjectIds: string[];
}
interface RoomOption {
  id: string;
  code: string;
  name: string;
  capacity: number;
  roomType: string;
}
interface LaboratoryOption {
  id: string;
  code: string;
  name: string;
  capacity: number;
}

export interface SlotEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timetableId: string;
  day: string;
  slot?: GridSlot;
  cell?: Cell;
  classSubjects: SubjectOption[];
  onSaved?: () => void;
}

/**
 * Edit one timetable cell: subject, faculty, room or laboratory.
 * The server re-checks every hard constraint (faculty, room, lab, availability,
 * break protection) and rejects the change with a readable reason.
 */
export function SlotEditor({ open, onOpenChange, timetableId, day, slot, cell, classSubjects, onSaved }: SlotEditorProps) {
  const confirm = useConfirm();
  const invalidate = useInvalidate();
  const options = useApi<{ faculty: FacultyOption[]; rooms: RoomOption[]; laboratories: LaboratoryOption[] }>('/api/timetable/grid', undefined, {
    enabled: open,
    staleTime: 120_000,
  });

  const [subjectId, setSubjectId] = React.useState('');
  const [facultyId, setFacultyId] = React.useState('');
  const [roomId, setRoomId] = React.useState('');
  const [laboratoryId, setLaboratoryId] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSubjectId(cell?.subjectId ?? '');
    setFacultyId(cell?.facultyId ?? '');
    setRoomId(cell?.roomId ?? '');
    setLaboratoryId(cell?.laboratoryId ?? '');
    setError(null);
  }, [open, cell]);

  const faculty = options.data?.data?.faculty ?? [];
  const rooms = options.data?.data?.rooms ?? [];
  const laboratories = options.data?.data?.laboratories ?? [];

  // Only faculty who teach this subject are offered, with the rest still selectable.
  const facultyOptions = React.useMemo(() => {
    const teaching = faculty.filter((f) => f.subjectIds.includes(subjectId));
    const others = faculty.filter((f) => !f.subjectIds.includes(subjectId));
    return [
      ...teaching.map((f) => ({ value: f.id, label: `${f.name} — assigned to this subject` })),
      ...others.map((f) => ({ value: f.id, label: f.name })),
    ];
  }, [faculty, subjectId]);

  const save = async () => {
    if (!slot) return;
    setSaving(true);
    setError(null);
    try {
      if (cell?.slotId) {
        await api.patch(`/api/timetable/${timetableId}/slots/${cell.slotId}`, {
          dayOfWeek: day,
          periodIndex: slot.index,
          subjectId: subjectId || null,
          facultyId: facultyId || null,
          roomId: roomId || null,
          laboratoryId: laboratoryId || null,
        });
      } else {
        // Creating: the server upserts by (timetable, day, period).
        await api.patch(`/api/timetable/${timetableId}/slots/new`, {
          dayOfWeek: day,
          periodIndex: slot.index,
          subjectId: subjectId || null,
          facultyId: facultyId || null,
          roomId: roomId || null,
          laboratoryId: laboratoryId || null,
        });
      }
      toastSuccess('Timetable updated');
      invalidate('/api/timetable', '/api/dashboard');
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'That change was rejected.';
      setError(message);
      toastError(err, 'The slot was not changed.');
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!cell?.slotId) return;
    const ok = await confirm({
      title: 'Clear this period?',
      description: 'The subject, faculty and room assignment for this period will be removed. Students see the change immediately.',
      confirmLabel: 'Clear period',
    });
    if (!ok) return;
    try {
      await api.delete(`/api/timetable/${timetableId}/slots/${cell.slotId}`);
      toastSuccess('Period cleared');
      invalidate('/api/timetable', '/api/dashboard');
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toastError(err, 'That period could not be cleared.');
    }
  };

  if (!slot) return null;
  const isLab = classSubjects.find((s) => s.id === subjectId)?.subjectType === 'LABORATORY';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        title={`Edit period · ${day.charAt(0) + day.slice(1).toLowerCase()} P${slot.teachingIndex}`}
        description={`${slot.startTime}–${slot.endTime} · ${cell?.className ?? 'Class'}`}
      >
        <div className="space-y-3">
          {error ? <Alert tone="danger" title="Change rejected">{error}</Alert> : null}

          <Field label="Subject" htmlFor="slot-subject" hint="Only subjects assigned to this class are listed.">
            <Select
              id="slot-subject"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              placeholder="Free period"
              options={classSubjects.map((subject) => ({
                value: subject.id,
                label: `${subject.code} — ${subject.name}${subject.subjectType === 'LABORATORY' ? ' (lab)' : ''}`,
              }))}
            />
          </Field>

          <Field label="Faculty" htmlFor="slot-faculty" hint={subjectId ? 'Faculty assigned to this subject are listed first.' : 'Choose a subject first for a smart suggestion.'}>
            <Select id="slot-faculty" value={facultyId} onChange={(event) => setFacultyId(event.target.value)} placeholder="Unassigned" options={facultyOptions} />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={isLab ? 'Laboratory' : 'Room'} htmlFor="slot-room">
              {isLab ? (
                <Select
                  id="slot-room"
                  value={laboratoryId}
                  onChange={(event) => setLaboratoryId(event.target.value)}
                  placeholder="No laboratory"
                  options={laboratories.map((lab) => ({ value: lab.id, label: `${lab.code} — ${lab.name} (${lab.capacity})` }))}
                />
              ) : (
                <Select
                  id="slot-room"
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                  placeholder="No room"
                  options={rooms.map((room) => ({ value: room.id, label: `${room.code} — ${room.name} (${room.capacity})` }))}
                />
              )}
            </Field>
            <div className="flex items-end">
              <Badge tone={isLab ? 'accent' : 'info'}>{isLab ? 'Laboratory session' : 'Theory session'}</Badge>
            </div>
          </div>

          <p className="text-xs text-muted">
            Conflicts with another class, a faculty member&apos;s availability or a configured break are rejected with the reason shown above.
          </p>
        </div>

        <DialogFooter>
          {cell?.slotId ? (
            <Button variant="ghost" size="sm" onClick={clear} className="mr-auto">
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Clear period
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="mr-auto">
              <Eraser className="h-3.5 w-3.5" aria-hidden />
              Cancel
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={saving || !subjectId}>
            <Save className="h-3.5 w-3.5" aria-hidden />
            Save period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
