/**
 * University result document parsing.
 *
 * Real result sheets vary wildly between universities, so the parser tries
 * several strategies in order and always reports what it managed to read:
 *
 *   1. structured JSON  (an export from the university portal)
 *   2. CSV / TSV        (delimiter detected)
 *   3. wide table       (register number + columns under a subject header)
 *   4. record blocks    (register number line followed by "SUBJECT: 78" lines)
 *
 * Anything it cannot read is reported in `warnings`, and the caller falls back
 * to a clearly-labelled simulated extraction so the analytics screens remain
 * usable in a demo environment.
 */

export type SubjectOutcomeStatus = 'PASS' | 'FAIL';

export interface ParsedSubjectMark {
  code?: string;
  name?: string;
  marks?: number;
  grade?: string;
  status?: SubjectOutcomeStatus;
}

export interface ParsedResultRow {
  registerNumber: string;
  studentName?: string;
  subjects: ParsedSubjectMark[];
  gpa?: number;
  arrears: string[];
}

export interface ParsedResultDocument {
  strategy: 'json' | 'csv' | 'table' | 'blocks' | 'none';
  rows: ParsedResultRow[];
  semester?: number;
  title?: string;
  declaredOn?: Date;
  warnings: string[];
}

const REGISTER_PATTERNS = [
  /\b(\d{2}[A-Z]{2,4}\d{2,4})\b/, // 21CS001
  /\b([A-Z]{2,4}\d{4,8})\b/, // CS21001
  /\b(\d{4}[A-Z]{2,4}\d{2,4})\b/, // 2021CS01
];

const FAIL_GRADES = new Set(['F', 'RA', 'W', 'AB', 'I', 'FAIL', 'FAILED', 'UF']);
const PASS_GRADES = new Set(['O', 'A+', 'A', 'B+', 'B', 'C', 'S', 'E', 'D', 'P', 'PASS']);

function findRegisterNumber(line: string): string | undefined {
  for (const pattern of REGISTER_PATTERNS) {
    const match = line.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return undefined;
}

function extractGpa(text: string): number | undefined {
  const m = text.match(/(?:cgpa|gpa|sgpa|grade point average)\s*[:=]?\s*(\d{1,2}(?:\.\d{1,2})?)/i);
  if (!m) return undefined;
  const value = Number(m[1]);
  return Number.isFinite(value) && value <= 10 ? value : undefined;
}

function looksLikeGrade(cell: string) {
  const v = cell.trim().toUpperCase();
  return FAIL_GRADES.has(v) || PASS_GRADES.has(v);
}

function statusFromGradeOrMarks(grade?: string, marks?: number, passMarks = 50): SubjectOutcomeStatus {
  if (grade) return FAIL_GRADES.has(grade.toUpperCase()) ? 'FAIL' : 'PASS';
  if (typeof marks === 'number') return marks >= passMarks ? 'PASS' : 'FAIL';
  return 'PASS';
}

function splitCells(line: string): string[] {
  return line
    .split(/\t|\s{2,}|\s\|\s/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

// ── 1. JSON ──────────────────────────────────────────────────────────────
function tryJson(text: string): ParsedResultDocument | null {
  if (!text.trim().startsWith('[') && !text.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    const array = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { rows?: unknown[] }).rows)
        ? (parsed as { rows: unknown[] }).rows
        : Array.isArray((parsed as { results?: unknown[] }).results)
          ? (parsed as { results: unknown[] }).results
          : null;
    if (!array) return null;

    const rows: ParsedResultRow[] = [];
    for (const item of array as Record<string, unknown>[]) {
      const registerNumber = String(
        item.registerNumber ?? item.register_number ?? item.regNo ?? item.rollNo ?? item.roll ?? '',
      ).toUpperCase();
      if (!registerNumber) continue;
      const rawSubjects = (item.subjects ?? item.papers ?? []) as Record<string, unknown>[];
      const subjects: ParsedSubjectMark[] = rawSubjects.map((s) => {
        const marks = s.marks !== undefined ? Number(s.marks) : s.mark !== undefined ? Number(s.mark) : undefined;
        const grade = s.grade ? String(s.grade) : undefined;
        return {
          code: s.code ? String(s.code) : undefined,
          name: s.name || s.title ? String(s.name ?? s.title) : undefined,
          marks: Number.isFinite(marks) ? marks : undefined,
          grade,
          status: (String(s.status ?? '').toUpperCase() === 'FAIL' ? 'FAIL' : undefined) ?? statusFromGradeOrMarks(grade, marks),
        };
      });
      rows.push({
        registerNumber,
        studentName: item.name ? String(item.name) : undefined,
        subjects,
        gpa: item.gpa !== undefined ? Number(item.gpa) : item.cgpa !== undefined ? Number(item.cgpa) : undefined,
        arrears: subjects.filter((s) => s.status === 'FAIL').map((s) => s.name ?? s.code ?? 'Subject'),
      });
    }
    if (rows.length === 0) return null;
    const meta = parsed as { semester?: number; title?: string; declaredOn?: string };
    return {
      strategy: 'json',
      rows,
      semester: meta.semester ? Number(meta.semester) : undefined,
      title: meta.title ? String(meta.title) : undefined,
      declaredOn: meta.declaredOn ? new Date(meta.declaredOn) : undefined,
      warnings: [],
    };
  } catch {
    return null;
  }
}

// ── 2. CSV / TSV ─────────────────────────────────────────────────────────
function tryCsv(text: string): ParsedResultDocument | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 3) return null;
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].split(',').length >= 3 ? ',' : null;
  if (!delimiter) return null;

  const header = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
  const regIdx = header.findIndex((h) => /reg|roll|enrol|usn/i.test(h));
  const nameIdx = header.findIndex((h) => /name/i.test(h));
  const gpaIdx = header.findIndex((h) => /gpa|cgpa/i.test(h));
  if (regIdx === -1) return null;

  const subjectColumns = header
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => i !== regIdx && i !== nameIdx && i !== gpaIdx && h.length > 0);

  const rows: ParsedResultRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
    const registerNumber = (cells[regIdx] ?? '').toUpperCase();
    if (!registerNumber) continue;
    const subjects: ParsedSubjectMark[] = [];
    for (const col of subjectColumns) {
      const raw = cells[col.i];
      if (!raw) continue;
      const numeric = Number(raw);
      const grade = looksLikeGrade(raw) ? raw.toUpperCase() : undefined;
      const codeMatch = col.h.match(/\b([A-Z]{2,4}\d{2,5}|\d{2}[A-Z]{2,4}\d{2,4})\b/);
      subjects.push({
        code: codeMatch?.[1],
        name: col.h.replace(codeMatch?.[1] ?? '', '').replace(/[_-]+/g, ' ').trim() || col.h,
        marks: Number.isFinite(numeric) && !grade ? numeric : undefined,
        grade,
        status: statusFromGradeOrMarks(grade, Number.isFinite(numeric) ? numeric : undefined),
      });
    }
    rows.push({
      registerNumber,
      studentName: nameIdx >= 0 ? cells[nameIdx] : undefined,
      subjects,
      gpa: gpaIdx >= 0 && Number.isFinite(Number(cells[gpaIdx])) ? Number(cells[gpaIdx]) : undefined,
      arrears: subjects.filter((s) => s.status === 'FAIL').map((s) => s.name ?? s.code ?? 'Subject'),
    });
  }

  if (rows.length === 0) return null;
  const semester = extractSemester(text);
  return { strategy: 'csv', rows, semester, warnings: [] };
}

function extractSemester(text: string): number | undefined {
  const m = text.match(/semester[:\s-]*([1-8])(?:st|nd|rd|th)?\b/i) ?? text.match(/\bsem(?:ester)?[\s.-]*([1-8])\b/i);
  return m ? Number(m[1]) : undefined;
}

// ── 3. Wide table ────────────────────────────────────────────────────────
function tryTable(text: string): ParsedResultDocument | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const warnings: string[] = [];

  // Header: the first line with >= 3 subject-code-looking cells and no register number
  let headerIndex = -1;
  let headerSubjects: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 40); i += 1) {
    const line = lines[i];
    if (findRegisterNumber(line)) continue;
    const codes = line.match(/\b(\d{2}[A-Z]{2,4}\d{2,4}|[A-Z]{2,4}\d{2,5})\b/g);
    if (codes && codes.length >= 3) {
      headerIndex = i;
      headerSubjects = codes;
      break;
    }
    const cells = splitCells(line);
    if (cells.length >= 4 && cells.every((c) => c.length < 34) && !/\d{3}/.test(line)) {
      headerIndex = i;
      headerSubjects = cells.filter((c) => !/reg|roll|name|gpa|cgpa|total|result/i.test(c));
      if (headerSubjects.length >= 3) break;
      headerIndex = -1;
      headerSubjects = [];
    }
  }

  const rows: ParsedResultRow[] = [];
  for (const line of lines) {
    const registerNumber = findRegisterNumber(line);
    if (!registerNumber) continue;
    const cells = splitCells(line);
    const regCell = cells.find((c) => c.toUpperCase().includes(registerNumber)) ?? '';
    const rest = cells.filter((c) => c !== regCell);

    // Name = leading alphabetic cells
    const nameParts: string[] = [];
    let cursor = 0;
    while (cursor < rest.length && /^[A-Za-z.]+$/.test(rest[cursor]) && nameParts.join(' ').length < 40) {
      nameParts.push(rest[cursor]);
      cursor += 1;
    }
    const valueCells = rest.slice(cursor);
    const numbers = valueCells
      .map((c) => Number(c.replace(/[^\d.-]/g, '')))
      .filter((n) => Number.isFinite(n));
    const grades = valueCells.filter(looksLikeGrade).map((g) => g.toUpperCase());

    const subjects: ParsedSubjectMark[] = headerSubjects.map((subject, index) => {
      const marks = numbers[index];
      const grade = grades[index];
      const codeMatch = subject.match(/^\d{2}[A-Z]{2,4}\d{2,4}$|^[A-Z]{2,4}\d{2,5}$/);
      return {
        code: codeMatch ? subject : undefined,
        name: codeMatch ? undefined : subject,
        marks: marks !== undefined && marks <= 100 ? marks : undefined,
        grade,
        status: statusFromGradeOrMarks(grade, marks !== undefined && marks <= 100 ? marks : undefined),
      };
    });

    if (subjects.length === 0 && numbers.length > 0) {
      numbers.slice(0, 8).forEach((marks, index) => {
        subjects.push({ name: `Subject ${index + 1}`, marks, status: statusFromGradeOrMarks(undefined, marks) });
      });
      warnings.push('No subject header was detected; marks were mapped positionally.');
    }

    rows.push({
      registerNumber,
      studentName: nameParts.join(' ') || undefined,
      subjects,
      gpa: extractGpa(line),
      arrears: subjects.filter((s) => s.status === 'FAIL').map((s) => s.name ?? s.code ?? 'Subject'),
    });
  }

  if (rows.length === 0) return null;
  return {
    strategy: 'table',
    rows,
    semester: extractSemester(text),
    warnings: Array.from(new Set(warnings)),
  };
}

// ── 4. Record blocks ─────────────────────────────────────────────────────
function tryBlocks(text: string): ParsedResultDocument | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedResultRow[] = [];
  let current: ParsedResultRow | null = null;

  for (const line of lines) {
    const registerNumber = findRegisterNumber(line);
    if (registerNumber) {
      if (current) rows.push(current);
      current = {
        registerNumber,
        studentName: line.replace(registerNumber, '').replace(/[:\-|]/g, ' ').replace(/\s+/g, ' ').trim() || undefined,
        subjects: [],
        arrears: [],
        gpa: extractGpa(line),
      };
      continue;
    }
    if (!current) continue;

    const gpa = extractGpa(line);
    if (gpa !== undefined) current.gpa = gpa;

    // "Computer Networks: 78" | "CS501 - 78 (Pass)" | "DBMS  RA"
    const m = line.match(/^([A-Za-z0-9 .&+-]{3,50}?)\s*(?:[:\-–]|=)\s*(\d{1,3})\s*(?:\(([^)]{2,12})\))?/) ??
      line.match(/^([A-Za-z0-9 .&+-]{3,50}?)\s+(O|A\+|A|B\+|B|C|S|E|RA|W|AB|F)\b/);
    if (m) {
      const label = m[1].trim();
      const marks = m[2] ? Number(m[2]) : undefined;
      const grade = (m[3] ?? (m[2] ? undefined : m[2])).toString().toUpperCase();
      const resolvedGrade = looksLikeGrade(grade) ? grade : undefined;
      const codeMatch = label.match(/^(\d{2}[A-Z]{2,4}\d{2,4}|[A-Z]{2,4}\d{2,5})$/);
      current.subjects.push({
        code: codeMatch?.[1],
        name: codeMatch ? label.slice(codeMatch[1].length).trim() || undefined : label,
        marks,
        grade: resolvedGrade,
        status: statusFromGradeOrMarks(resolvedGrade, marks),
      });
    }
  }
  if (current) rows.push(current);

  const usable = rows.filter((r) => r.subjects.length > 0);
  if (usable.length === 0) return null;
  for (const row of usable) {
    row.arrears = row.subjects.filter((s) => s.status === 'FAIL').map((s) => s.name ?? s.code ?? 'Subject');
  }
  return { strategy: 'blocks', rows: usable, semester: extractSemester(text), warnings: [] };
}

export function parseResultDocument(text: string): ParsedResultDocument {
  const attempts = [tryJson, tryCsv, tryTable, tryBlocks];
  for (const attempt of attempts) {
    const result = attempt(text);
    if (result && result.rows.length > 0) return result;
  }
  return {
    strategy: 'none',
    rows: [],
    semester: extractSemester(text),
    warnings: ['No student rows could be read from this document.'],
  };
}

export { statusFromGradeOrMarks };
