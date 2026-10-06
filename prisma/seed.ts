/**
 * CampusIQ demo seed.
 *
 * Creates a realistic, internally-consistent institution:
 *   1 admin · 5 faculty · 59 students · 4 departments · 18 subjects
 *   5 classes · attendance for 4 weeks · IA-1/IA-2 marks · two university
 *   results with arrears · published weekly timetables · sample resumes,
 *   job descriptions and match analyses.
 *
 * Demo credentials (see README):
 *   admin@campusiq.edu.in        / Admin@2026
 *   priya.menon@campusiq.edu.in  / Faculty@2026
 *   arjun.nair@campusiq.edu.in   / Student@2026
 *
 * The seed is idempotent: it clears CampusIQ data and rebuilds it, so
 * `npm run db:seed` can be re-run safely.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { MockAIService } from '@/lib/ai/mock';
import { SKILL_TAXONOMY } from '@/lib/ai/skills';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/campusiq?schema=public';
const schema = new URL(connectionString.replace(/\?.*$/, '') + '?x=1').searchParams.get('schema') ?? 'public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 8 }, { schema }) });

// ─────────────────────────────────────────────────────────────────────────
// Deterministic randomness — the same demo data every run
// ─────────────────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261006);
const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)];
const chance = (p: number) => rand() < p;
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const DAY_TIMES: Record<number, [string, string]> = {
  0: ['09:00', '09:50'],
  1: ['09:50', '10:40'],
  2: ['10:40', '10:55'],
  3: ['10:55', '11:45'],
  4: ['11:45', '12:35'],
  5: ['12:35', '13:15'],
  6: ['13:15', '14:05'],
  7: ['14:05', '14:50'],
  8: ['14:50', '15:00'],
  9: ['15:00', '15:50'],
  10: ['15:50', '16:40'],
};
const WORKING_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
const TEACHING_INDICES = [0, 1, 3, 4, 6, 7, 9, 10];
const BREAKS: { index: number; label: string }[] = [
  { index: 2, label: 'Morning Break' },
  { index: 5, label: 'Lunch' },
  { index: 8, label: 'Evening Break' },
];

const iso = (d: Date) => new Date(d.toISOString().slice(0, 10));

// ─────────────────────────────────────────────────────────────────────────
// Wipe
// ─────────────────────────────────────────────────────────────────────────

async function wipe() {
  const models: string[] = [
    'auditLog',
    'notification',
    'skillGap',
    'resumeJobMatch',
    'resumeSkill',
    'resumeAnalysis',
    'jobAnalysis',
    'jobDescription',
    'resume',
    'fileAsset',
    'arrear',
    'universityResultSubject',
    'studentResult',
    'universityResult',
    'iAMark',
    'iAExam',
    'attendanceRecord',
    'attendanceSession',
    'timetableSlot',
    'timetable',
    'schedulingConstraint',
    'facultyAvailability',
    'facultySubject',
    'enrollment',
    'classSubject',
    'student',
    'faculty',
    'user',
    'session',
    'passwordResetToken',
    'skill',
    'room',
    'laboratory',
    'subject',
    'class',
    'academicYear',
    'department',
    'systemSetting',
  ];
  for (const model of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any)[model].deleteMany({});
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Academic structure
// ─────────────────────────────────────────────────────────────────────────

interface SubjectDef {
  code: string;
  name: string;
  dept: string;
  type: 'THEORY' | 'LABORATORY';
  periods: number;
  credits: number;
  pps?: number;
}

const SUBJECTS: SubjectDef[] = [
  { code: 'CS501', name: 'Data Structures & Applications', dept: 'CSE', type: 'THEORY', periods: 4, credits: 4 },
  { code: 'CS502', name: 'Database Management Systems', dept: 'CSE', type: 'THEORY', periods: 3, credits: 3 },
  { code: 'CS503', name: 'Computer Networks', dept: 'CSE', type: 'THEORY', periods: 3, credits: 3 },
  { code: 'CS504', name: 'Operating Systems', dept: 'CSE', type: 'THEORY', periods: 3, credits: 3 },
  { code: 'CS505', name: 'Software Engineering', dept: 'CSE', type: 'THEORY', periods: 2, credits: 3 },
  { code: 'CS591', name: 'Data Structures Laboratory', dept: 'CSE', type: 'LABORATORY', periods: 2, credits: 1, pps: 2 },
  { code: 'EC501', name: 'Digital System Design', dept: 'ECE', type: 'THEORY', periods: 3, credits: 3 },
  { code: 'EC502', name: 'Signals & Systems', dept: 'ECE', type: 'THEORY', periods: 3, credits: 4 },
  { code: 'EC503', name: 'Microprocessors & Microcontrollers', dept: 'ECE', type: 'THEORY', periods: 3, credits: 3 },
  { code: 'EC591', name: 'Digital Electronics Laboratory', dept: 'ECE', type: 'LABORATORY', periods: 2, credits: 1, pps: 2 },
  { code: 'ME501', name: 'Engineering Thermodynamics', dept: 'MECH', type: 'THEORY', periods: 3, credits: 4 },
  { code: 'ME502', name: 'Machine Design', dept: 'MECH', type: 'THEORY', periods: 3, credits: 4 },
  { code: 'ME591', name: 'Strength of Materials Laboratory', dept: 'MECH', type: 'LABORATORY', periods: 2, credits: 1, pps: 2 },
  { code: 'CE501', name: 'Structural Analysis', dept: 'CIVIL', type: 'THEORY', periods: 3, credits: 3 },
  { code: 'CE502', name: 'Surveying & GPS', dept: 'CIVIL', type: 'THEORY', periods: 2, credits: 3 },
  { code: 'CE591', name: 'Geotechnical Laboratory', dept: 'CIVIL', type: 'LABORATORY', periods: 2, credits: 1, pps: 2 },
];

interface ClassDef {
  key: string;
  dept: string;
  year: number;
  section: string;
  semester: number;
  subjectCodes: string[];
}

const CLASSES: ClassDef[] = [
  {
    key: 'CSE3A',
    dept: 'CSE',
    year: 3,
    section: 'A',
    semester: 5,
    subjectCodes: ['CS501', 'CS502', 'CS503', 'CS504', 'CS505', 'CS591'],
  },
  {
    key: 'CSE3B',
    dept: 'CSE',
    year: 3,
    section: 'B',
    semester: 5,
    subjectCodes: ['CS501', 'CS502', 'CS503', 'CS504', 'CS505', 'CS591'],
  },
  {
    key: 'CSE1A',
    dept: 'CSE',
    year: 1,
    section: 'A',
    semester: 1,
    subjectCodes: [],
  },
  { key: 'ECE3A', dept: 'ECE', year: 3, section: 'A', semester: 5, subjectCodes: ['EC501', 'EC502', 'EC503', 'EC591'] },
  { key: 'ME2A', dept: 'MECH', year: 2, section: 'A', semester: 3, subjectCodes: ['ME501', 'ME502', 'ME591'] },
];

const FIRST_NAMES = [
  'Arjun', 'Diya', 'Karthik', 'Meenakshi', 'Vignesh', 'Ananya', 'Rohan', 'Sneha', 'Pranav', 'Divya',
  'Harish', 'Lakshmi', 'Nikhil', 'Priyanka', 'Abish', 'Rithika', 'Gokul', 'Shruti', 'Manoj', 'Ishita',
  'Vishal', 'Nandini', 'Arun', 'Kavya', 'Surya', 'Bhavani', 'Ramesh', 'Tanvi', 'Deepak', 'Sara',
];
const LAST_NAMES = [
  'Nair', 'Sharma', 'Rajan', 'Iyer', 'Krishnan', 'Venkatesh', 'Mohan', 'Balaji', 'Suresh', 'Ravi',
  'Kumar', 'Reddy', 'Pillai', 'Menon', 'Das', 'Chauhan', 'Patel', 'Singh', 'Gupta', 'Joshi',
];

const STUDENT_COUNTS: Record<string, number> = { CSE3A: 14, CSE3B: 13, CSE1A: 12, ECE3A: 10, ME2A: 10 };

// ─────────────────────────────────────────────────────────────────────────
// Career demo content
// ─────────────────────────────────────────────────────────────────────────

const ARJUN_RESUME = `ARJUN NAIR
Backend Engineer · Coimbatore · arjun.nair@campusiq.edu.in
----------------------------------------------------------------
SUMMARY
Final-year Computer Science student (CGPA 8.4) with two internships in
Python backends. Built and shipped REST services handling 40k daily
requests. Comfortable with Django, PostgreSQL, Docker and Redis.

EXPERIENCE
Backend Engineering Intern, Zoho Corporation (May 2026 – Aug 2026)
- Built Django REST endpoints for an invoicing microservice used by
  12,000 merchants; cut p95 latency from 620ms to 240ms with query
  indexing and Redis caching.
- Wrote 140+ unit tests with pytest; raised coverage from 55% to 88%.

SDE Intern, TCS Digital (Jan 2026 – Mar 2026)
- Designed a PostgreSQL schema for a logistics tracking portal.
- Implemented JWT authentication and role-based access control.

PROJECTS
CampusIQ Attendance (Django, PostgreSQL, Docker)
- Attendance management app with 85% test coverage, deployed via
  Docker Compose; used by 300+ students in a pilot.
Route Planner (React, TypeScript, Mapbox)
- Shortest-route utility with 1.2k GitHub stars.

SKILLS
Python, Django, REST API, PostgreSQL, Redis, Docker, Git, Linux,
React, TypeScript, JavaScript, SQL, Microservices

EDUCATION
B.E. Computer Science, St. Xavier Institute of Technology (2024 – 2028)
CGPA 8.4/10`;

const ZOHo_JD = `Backend Software Engineer
Zoho Corporation · Chennai (Hybrid)

We are looking for a backend software engineer to join our CRM platform
team. You will design and build highly available REST services.

Responsibilities
- Design and implement RESTful APIs in Python (Django/Flask).
- Model data in PostgreSQL and optimise slow queries.
- Use Redis for caching and Celery for background jobs.
- Containerise services with Docker and Kubernetes.
- Write automated tests and participate in code reviews.

Requirements
- Strong command of Python and object-oriented design.
- Experience with Django or Flask and REST API design.
- Solid SQL: joins, indexing, query tuning in PostgreSQL.
- Familiarity with Docker, Git and Linux command line.
- Basic understanding of microservices and message queues.

Nice to have
- Kubernetes, Redis, Kafka, Celery.
- Exposure to React/TypeScript for full-stack work.`;

const TCS_JD = `Software Engineer – Data
TCS · Coimbatore (On site)

Join our data engineering group building pipelines that power analytics
for retail clients.

Responsibilities
- Build ETL pipelines with Python (Pandas, SQL).
- Model data warehouses in PostgreSQL / Amazon Redshift.
- Schedule batch jobs with Apache Airflow.
- Write data quality tests and monitoring alerts.

Requirements
- Proficiency in Python and SQL.
- Experience with ETL/ELT tools (Airflow, dbt) or similar.
- Understanding of data modelling (star schema, slowly changing dimensions).
- Familiarity with Linux and Docker.

Nice to have
- Spark, Kafka, cloud platforms (AWS/GCP).`;

const DIYA_RESUME = `DIYA SHARMA
Product & Data Analyst · Coimbatore
----------------------------------------------------------------
SUMMARY
Final-year CSE student focused on product analytics. Led the analytics
stream of a 5-person startup team; comfortable with SQL, Python and
Excel dashboards.

EXPERIENCE
Product Analytics Intern, Freshworks (Jun 2026 – Aug 2026)
- Built weekly cohort dashboards in Looker Studio; churn reporting
  adopted by three customer success teams.
- Ran SQL queries over 40M-row event tables to quantify feature usage.

PROJECTS
College Fee Tracker (Python, Flask, SQLite)
- Automation script that emailed 200 parents with fee status.

SKILLS
SQL, Python, Pandas, Excel, Looker Studio, REST API, Git,
Communication, Data Visualisation

EDUCATION
B.E. Computer Science, St. Xavier Institute of Technology (2024 – 2028)
CGPA 8.1/10`;

const PRODUCT_JD = `Associate Product Manager
Freshworks · Coimbatore (Hybrid)

Plan and ship features for our HRM suite.

Responsibilities
- Own a backlog of 20+ features per quarter.
- Analyse usage data in SQL to prioritise work.
- Write clear PRDs and run A/B experiments.

Requirements
- Strong analytical skills: SQL and Python.
- Comfort with data visualisation (Looker, Excel).
- Excellent written communication.
- Computer science background or equivalent experience.

Nice to have
- Exposure to A/B testing, user research, REST APIs.`;

// ─────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('→ Wiping existing data…');
  await wipe();

  const now = new Date('2026-10-06T09:30:00.000Z');
  const ai = new MockAIService();

  console.log('→ Academic years…');
  const yearPast = await prisma.academicYear.create({
    data: { name: '2025-26', startDate: iso(new Date('2025-06-01')), endDate: iso(new Date('2026-05-31')), isCurrent: false },
  });
  const yearCurrent = await prisma.academicYear.create({
    data: { name: '2026-27', startDate: iso(new Date('2026-06-01')), endDate: iso(new Date('2027-05-31')), isCurrent: true },
  });

  console.log('→ Departments…');
  const deptDefs = [
    { code: 'CSE', name: 'Computer Science & Engineering', building: 'Block A' },
    { code: 'ECE', name: 'Electronics & Communication', building: 'Block B' },
    { code: 'MECH', name: 'Mechanical Engineering', building: 'Block C' },
    { code: 'CIVIL', name: 'Civil Engineering', building: 'Block D' },
  ];
  const departments: Record<string, { id: string }> = {};
  for (const d of deptDefs) {
    departments[d.code] = await prisma.department.create({ data: { ...d } });
  }

  console.log('→ Subjects…');
  const subjects: Record<string, { id: string; def: SubjectDef }> = {};
  for (const def of SUBJECTS) {
    subjects[def.code] = {
      id: (
        await prisma.subject.create({
          data: {
            code: def.code,
            name: def.name,
            departmentId: departments[def.dept].id,
            subjectType: def.type,
            semester: def.type === 'LABORATORY' ? 5 : 5,
            credits: def.credits,
            weeklyPeriods: def.periods,
            periodsPerSession: def.pps ?? 1,
            maxIaMarks: 50,
            maxTheoryMarks: 100,
            passMarks: 50,
          },
        })
      ).id,
      def,
    };
  }

  console.log('→ Rooms & laboratories…');
  const rooms: Record<string, string> = {};
  const roomDefs = [
    { code: 'A-201', name: 'CSE Classroom 1', capacity: 60, type: 'CLASSROOM' as const, building: 'Block A', floor: 2, dept: 'CSE', projector: true },
    { code: 'A-202', name: 'CSE Classroom 2', capacity: 55, type: 'CLASSROOM' as const, building: 'Block A', floor: 2, dept: 'CSE', projector: true },
    { code: 'A-203', name: 'CSE Classroom 3', capacity: 50, type: 'CLASSROOM' as const, building: 'Block A', floor: 2, dept: 'CSE', projector: false },
    { code: 'B-201', name: 'ECE Classroom 1', capacity: 55, type: 'CLASSROOM' as const, building: 'Block B', floor: 2, dept: 'ECE', projector: true },
    { code: 'C-201', name: 'MECH Classroom 1', capacity: 50, type: 'CLASSROOM' as const, building: 'Block C', floor: 2, dept: 'MECH', projector: false },
  ];
  for (const r of roomDefs) {
    rooms[r.code] = (
      await prisma.room.create({
        data: {
          code: r.code,
          name: r.name,
          capacity: r.capacity,
          roomType: r.type,
          building: r.building,
          floor: r.floor,
          hasProjector: r.projector,
          departmentId: departments[r.dept].id,
        },
      })
    ).id;
  }
  const labs: Record<string, { id: string; roomId: string }> = {};
  const labDefs = [
    { code: 'CS-LAB-1', name: 'Data Structures Lab', dept: 'CSE', roomCode: 'A-210' },
    { code: 'CS-LAB-2', name: 'Computer Lab 2', dept: 'CSE', roomCode: 'A-211' },
  ];
  for (const l of labDefs) {
    const labId = (
      await prisma.laboratory.create({
        data: {
          code: l.code,
          name: l.name,
          capacity: 60,
          equipment: '60 workstations, 1 projector',
          departmentId: departments[l.dept].id,
        },
      })
    ).id;
    const roomId = (
      await prisma.room.create({
        data: {
          code: l.roomCode,
          name: `${l.name} Room`,
          capacity: 60,
          roomType: 'LABORATORY',
          building: 'Block A',
          floor: 3,
          laboratoryId: labId,
        },
      })
    ).id;
    labs[l.code] = { id: labId, roomId };
  }

  console.log('→ Users (admin, faculty, students)…');
  const hash = (pw: string) => bcrypt.hash(pw, 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@campusiq.edu.in',
      passwordHash: await hash('Admin@2026'),
      role: 'ADMIN',
      firstName: 'Arun',
      lastName: 'Prakash',
      phone: '+91 98410 00001',
      status: 'ACTIVE',
      emailVerifiedAt: new Date('2026-06-01T10:00:00.000Z'),
    },
  });

  const facultyDefs = [
    { employeeId: 'FAC-CSE-01', email: 'priya.menon@campusiq.edu.in', first: 'Priya', last: 'Menon', dept: 'CSE', designation: 'Professor & HoD', spec: 'Databases & Distributed Systems', qual: 'Ph.D. (Anna University)', exp: 16, gender: 'FEMALE' as const, subjects: ['CS501', 'CS504'] },
    { employeeId: 'FAC-CSE-02', email: 'rajesh.kumar@campusiq.edu.in', first: 'Rajesh', last: 'Kumar', dept: 'CSE', designation: 'Assistant Professor', spec: 'Databases', qual: 'M.Tech (IIT Madras)', exp: 8, gender: 'MALE' as const, subjects: ['CS502', 'CS591'] },
    { employeeId: 'FAC-CSE-03', email: 'anitha.devi@campusiq.edu.in', first: 'Anitha', last: 'Devi', dept: 'CSE', designation: 'Associate Professor', spec: 'Computer Networks', qual: 'M.E. (PSGCT)', exp: 11, gender: 'FEMALE' as const, subjects: ['CS503', 'CS505'] },
    { employeeId: 'FAC-ECE-01', email: 'suresh.babu@campusiq.edu.in', first: 'Suresh', last: 'Babu', dept: 'ECE', designation: 'Professor', spec: 'Digital Electronics', qual: 'M.Tech (BITS Pilani)', exp: 19, gender: 'MALE' as const, subjects: ['EC501', 'EC502', 'EC503', 'EC591'] },
    { employeeId: 'FAC-ME-01', email: 'meera.krishnan@campusiq.edu.in', first: 'Meera', last: 'Krishnan', dept: 'MECH', designation: 'Assistant Professor', spec: 'Thermodynamics', qual: 'M.E. (Anna University)', exp: 7, gender: 'FEMALE' as const, subjects: ['ME501', 'ME502', 'ME591'] },
  ];

  const faculty: Record<string, { id: string; userId: string }> = {};
  for (const f of facultyDefs) {
    const user = await prisma.user.create({
      data: {
        email: f.email,
        passwordHash: await hash('Faculty@2026'),
        role: 'FACULTY',
        firstName: f.first,
        lastName: f.last,
        phone: `+91 98410 ${String(randInt(10000, 99999))}`,
        status: 'ACTIVE',
        emailVerifiedAt: new Date('2026-06-01T10:00:00.000Z'),
      },
    });
    const fac = await prisma.faculty.create({
      data: {
        userId: user.id,
        employeeId: f.employeeId,
        designation: f.designation,
        specialization: f.spec,
        qualification: f.qual,
        experienceYears: f.exp,
        gender: f.gender,
        joinedOn: iso(new Date(`20${String(randInt(6, 18)).padStart(2, '0')}-07-15`)),
        departmentId: departments[f.dept].id,
      },
    });
    faculty[f.employeeId] = { id: fac.id, userId: user.id };
  }
  await prisma.department.update({ where: { id: departments.CSE.id }, data: { headOfDepartmentId: faculty['FAC-CSE-01'].id } });
  await prisma.department.update({ where: { id: departments.ECE.id }, data: { headOfDepartmentId: faculty['FAC-ECE-01'].id } });
  await prisma.department.update({ where: { id: departments.MECH.id }, data: { headOfDepartmentId: faculty['FAC-ME-01'].id } });

  // Faculty ↔ subject assignments (class-aware where a class teaches it)
  const classById: Record<string, { id: string; def: ClassDef }> = {};
  for (const c of CLASSES) {
    const cls = await prisma.class.create({
      data: {
        name: `${c.dept} · Year ${c.year} · Section ${c.section}`,
        yearOfStudy: c.year,
        section: c.section,
        semester: c.semester,
        departmentId: departments[c.dept].id,
        academicYearId: yearCurrent.id,
      },
    });
    for (const code of c.subjectCodes) {
      await prisma.classSubject.create({ data: { classId: cls.id, subjectId: subjects[code].id } });
    }
    classById[c.key] = { id: cls.id, def: c };
  }

  for (const f of facultyDefs) {
    for (const code of f.subjects) {
      const classDefs = CLASSES.filter((c) => c.subjectCodes.includes(code));
      for (const cd of classDefs) {
        await prisma.facultySubject.create({
          data: { facultyId: faculty[f.employeeId].id, subjectId: subjects[code].id, classId: classById[cd.key].id },
        });
      }
    }
  }

  // Faculty availability — a couple of hard constraints for the scheduler
  await prisma.facultyAvailability.createMany({
    data: [
      { facultyId: faculty['FAC-CSE-02'].id, dayOfWeek: 'FRIDAY', periodIndex: 9, isAvailable: false, reason: 'Department meetings' },
      { facultyId: faculty['FAC-CSE-02'].id, dayOfWeek: 'TUESDAY', periodIndex: 10, isAvailable: false, reason: 'Conference presentation' },
      { facultyId: faculty['FAC-ECE-01'].id, dayOfWeek: 'WEDNESDAY', periodIndex: 9, isAvailable: false, reason: 'Exam duty' },
    ],
  });

  // Students
  interface StudentRec {
    id: string;
    userId: string;
    register: string;
    name: string;
    classKey: string;
    attendanceBias: number; // 0..1 — low means flaky
    cgpaBase: number;
  }
  const students: StudentRec[] = [];
  let globalRoll = 0;
  for (const c of CLASSES) {
    const count = STUDENT_COUNTS[c.key] ?? 0;
    for (let i = 0; i < count; i++) {
      globalRoll += 1;
      const first = c.key === 'CSE3A' && i === 0 ? 'Arjun' : FIRST_NAMES[(globalRoll * 7 + i) % FIRST_NAMES.length];
      const last = c.key === 'CSE3A' && i === 0 ? 'Nair' : c.key === 'CSE3A' && i === 1 ? 'Sharma' : LAST_NAMES[(globalRoll * 11 + i) % LAST_NAMES.length];
      const regPrefix = c.key.startsWith('CSE') ? 'CS' : c.key.startsWith('ECE') ? 'EC' : 'ME';
      const regYear = c.key.startsWith('CSE1') ? '25' : '24';
      const sectionRoll = c.key.endsWith('B') ? '1' + String(i + 1).padStart(2, '0') : String(i + 1).padStart(3, '0');
      const registerNumber = `${regYear}${regPrefix}${sectionRoll}`;
      const emailBase = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
      const email = c.key === 'CSE3A' && i === 0 ? 'arjun.nair@campusiq.edu.in' : `${emailBase}.${regYear}${String(i + 1)}${c.section.toLowerCase()}@campusiq.edu.in`;
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: await hash('Student@2026'),
          role: 'STUDENT',
          firstName: first,
          lastName: last,
          phone: chance(0.7) ? `+91 9${String(randInt(100000000, 999999999))}` : null,
          status: 'ACTIVE',
          emailVerifiedAt: new Date('2026-06-10T10:00:00.000Z'),
        },
      });
      const student = await prisma.student.create({
        data: {
          userId: user.id,
          registerNumber,
          rollNumber: String(i + 1),
          admissionYear: regYear === '25' ? 2025 : 2024,
          semester: c.semester,
          gender: pick(['MALE', 'FEMALE'] as const),
          dateOfBirth: iso(new Date(`20${String(randInt(7, 8)).padStart(2, '0')}-0${randInt(1, 9)}-${String(randInt(10, 28))}`)),
          city: pick(['Coimbatore', 'Madurai', 'Tiruppur', 'Salem', 'Erode']),
          guardianName: `${pick(LAST_NAMES.slice(20))} ${last}`,
          academicStatus: 'ACTIVE',
          departmentId: departments[c.dept].id,
          classId: classById[c.key].id,
        },
      });
      // Per-student attendance personality: a few chronic flake, most fine.
      let bias = 0.93 - rand() * 0.1;
      if (chance(0.12)) bias = 0.7 - rand() * 0.08; // at-risk / debarred
      students.push({ id: student.id, userId: user.id, register: registerNumber, name: `${first} ${last}`, classKey: c.key, attendanceBias: bias, cgpaBase: 6.8 + rand() * 2.6 });
    }
  }

  // Enrollments
  const enrollmentRows: Prisma.EnrollmentCreateManyInput[] = [];
  for (const s of students) {
    const c = classById[s.classKey].def;
    for (const code of c.subjectCodes) {
      enrollmentRows.push({
        studentId: s.id,
        subjectId: subjects[code].id,
        classId: classById[s.classKey].id,
        academicYearId: yearCurrent.id,
        semester: c.semester,
      });
    }
  }
  await prisma.enrollment.createMany({ data: enrollmentRows });

  console.log('→ System settings…');
  await prisma.systemSetting.createMany({
    data: [
      { key: 'attendance.thresholds', value: { safe: 80, fine: 75, debar: 70, countLateAsPresent: true }, category: 'attendance', description: 'Safe / fine / debar attendance thresholds', updatedById: adminUser.id },
      {
        key: 'timetable.config',
        value: {
          periodMinutes: 50,
          minPeriodMinutes: 40,
          workStart: '09:00',
          workEnd: '17:00',
          breaks: [
            { label: 'Morning Break', start: '10:40', end: '10:55' },
            { label: 'Lunch', start: '12:35', end: '13:15' },
            { label: 'Evening Break', start: '14:50', end: '15:00' },
          ],
          workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
          maxSameSubjectPerDay: 2,
          labContiguous: true,
          autoAssignRooms: true,
          generationAttempts: 60,
        },
        category: 'timetable',
        description: 'Period length, working hours and break windows',
        updatedById: adminUser.id,
      },
      {
        key: 'academic.config',
        value: { semester: 5, currentAcademicYearId: yearCurrent.id, iaExamCount: 2, passMarkPercentage: 50 },
        category: 'academic',
        description: 'Active semester and assessment rules',
        updatedById: adminUser.id,
      },
      {
        key: 'institution.profile',
        value: {
          name: 'St. Xavier Institute of Technology',
          shortName: 'SXIT',
          tagline: 'Intelligent Solutions for a Smarter Campus',
          address: 'Campus Road, Coimbatore, Tamil Nadu 641021',
          email: 'office@campusiq.edu.in',
          phone: '+91 422 255 0100',
          website: 'https://campusiq.edu.in',
        },
        category: 'institution',
        description: 'Institution name and contact details',
        isPublic: true,
        updatedById: adminUser.id,
      },
    ],
  });

  // ── Timetables (published, conflict-free by construction) ─────────────
  console.log('→ Timetables…');
  const facultyForSubject: Record<string, string> = {
    CS501: faculty['FAC-CSE-01'].id,
    CS502: faculty['FAC-CSE-02'].id,
    CS503: faculty['FAC-CSE-03'].id,
    CS504: faculty['FAC-CSE-01'].id,
    CS505: faculty['FAC-CSE-03'].id,
    CS591: faculty['FAC-CSE-02'].id,
    EC501: faculty['FAC-ECE-01'].id,
    EC502: faculty['FAC-ECE-01'].id,
    EC503: faculty['FAC-ECE-01'].id,
    EC591: faculty['FAC-ECE-01'].id,
    ME501: faculty['FAC-ME-01'].id,
    ME502: faculty['FAC-ME-01'].id,
    ME591: faculty['FAC-ME-01'].id,
  };
  const deptRooms: Record<string, string[]> = {
    CSE: [rooms['A-201'], rooms['A-202'], rooms['A-203']],
    ECE: [rooms['B-201']],
    MECH: [rooms['C-201']],
  };
  const classRooms: Record<string, string[]> = {
    CSE3A: [rooms['A-201'], rooms['A-202']],
    CSE3B: [rooms['A-202'], rooms['A-203']],
    ECE3A: [rooms['B-201']],
    ME2A: [rooms['C-201']],
  };

  const timetableIds: Record<string, string> = {};
  for (const c of CLASSES) {
    if (c.subjectCodes.length === 0) continue;
    const cls = classById[c.key];
    // Per-class occupancy map: (day, index) → subject code
    const occupancy = new Map<string, string>();
    const perDaySubject = new Map<string, number>();
    const roomCycle: Record<string, number> = {};
    const roomList = classRooms[c.key] ?? [];
    let roomIdx = 0;

    // Place labs first (need contiguous doubles), then theory.
    const ordered = c.subjectCodes
      .map((code) => subjects[code])
      .sort((a, b) => (a.def.type === 'LABORATORY' ? -1 : 0) - (b.def.type === 'LABORATORY' ? -1 : 0));

    const slotRows: Omit<Prisma.TimetableSlotCreateManyInput, 'timetableId'>[] = [];
    const pushSlot = (day: (typeof WORKING_DAYS)[number], index: number, subjectCode?: string) => {
      const [startTime, endTime] = DAY_TIMES[index];
      slotRows.push({
        dayOfWeek: day,
        periodIndex: index,
        startTime,
        endTime,
        isBreak: !subjectCode,
        breakLabel: subjectCode ? null : BREAKS.find((b) => b.index === index)?.label ?? null,
        classId: cls.id,
        subjectId: subjectCode ? subjects[subjectCode].id : null,
        facultyId: subjectCode ? facultyForSubject[subjectCode] ?? null : null,
        roomId: subjectCode ? roomList[roomIdx++ % Math.max(roomList.length, 1)] ?? null : null,
        laboratoryId: subjectCode && subjects[subjectCode].def.type === 'LABORATORY' ? (c.dept === 'CSE' ? labs['CS-LAB-1'].id : null) : null,
      });
    };

    for (const day of WORKING_DAYS) {
      for (const b of BREAKS) pushSlot(day, b.index);
    }

    for (const s of ordered) {
      const code = s.def.code;
      if (s.def.type === 'LABORATORY') {
        // Two contiguous teaching slots on one day (Mon/Wed pairs: 0+1, 6+7)
        const labBase: [(typeof WORKING_DAYS)[number], number][] = [
          ['MONDAY', 0], ['WEDNESDAY', 6], ['FRIDAY', 0], ['TUESDAY', 6], ['THURSDAY', 9],
        ];
        const labStart = (classById[c.key] ? c.key.charCodeAt(2) : 0) % labBase.length;
        const pairs = [...labBase.slice(labStart), ...labBase.slice(0, labStart)];
        let placed = 0;
        for (const [day, start] of pairs) {
          if (placed >= s.def.periods) break;
          const next = start + 1;
          if (DAY_TIMES[start] && DAY_TIMES[next] && !occupancy.has(`${day}:${start}`) && !occupancy.has(`${day}:${next}`)) {
            for (const idx of [start, next]) {
              occupancy.set(`${day}:${idx}`, code);
              pushSlot(day, idx, code);
              placed += 1;
            }
          }
        }
      } else {
        // Spread each subject across the week: subjects start on staggered
        // days (stride 2 over 5 days) and each period advances to the next
        // day, so no single day piles up and none is left empty.
        const subjectSlot = ordered.indexOf(s);
        let remaining = s.def.periods;
        let dayOffset = (subjectSlot * 2) % WORKING_DAYS.length;
        for (let step = 0; remaining > 0; step++) {
          const day = WORKING_DAYS[(dayOffset + step) % WORKING_DAYS.length];
          for (const index of TEACHING_INDICES) {
            if (remaining <= 0) break;
            if (occupancy.has(`${day}:${index}`)) continue;
            const dayCount = perDaySubject.get(`${day}:${code}`) ?? 0;
            if (dayCount >= 2) continue; // max 2 per day
            occupancy.set(`${day}:${index}`, code);
            perDaySubject.set(`${day}:${code}`, dayCount + 1);
            pushSlot(day, index, code);
            remaining -= 1;
          }
        }
      }
    }

    const timetable = await prisma.timetable.create({
      data: {
        name: `${c.dept} · Year ${c.year} · Section ${c.section} — Week ${c.semester % 2 === 1 ? 'A' : 'B'}`,
        version: 1,
        status: 'PUBLISHED',
        generatedAt: now,
        classId: cls.id,
        academicYearId: yearCurrent.id,
        generatedById: faculty['FAC-CSE-01'].id,
        conflicts: [],
        metrics: { placedSlots: slotRows.filter((s) => !s.isBreak).length, conflicts: 0, attempts: 1 },
      },
    });
    timetableIds[c.key] = timetable.id;
    await prisma.timetableSlot.createMany({ data: slotRows.map((r) => ({ ...r, timetableId: timetable.id })) });
  }

  // ── Attendance: last 4 working weeks, from the class timetables ───────
  console.log('→ Attendance…');
  const sessionStart = iso(new Date('2026-09-07'));
  const sessionEnd = iso(new Date('2026-10-02'));
  const attendanceSessions: Prisma.AttendanceSessionCreateManyInput[] = [];
  const studentByClass: Record<string, StudentRec[]> = {};
  for (const s of students) (studentByClass[s.classKey] ??= []).push(s);

  for (let d = new Date(sessionStart); d <= sessionEnd; d.setDate(d.getDate() + 1)) {
    const day = d;
    const jsDay = day.getDay(); // 0 Sun
    const dayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][jsDay];
    if (!(WORKING_DAYS as readonly string[]).includes(dayName)) continue;

    for (const c of CLASSES) {
      const ttId = timetableIds[c.key];
      if (!ttId) continue;
      const slots = await prisma.timetableSlot.findMany({
        where: { timetableId: ttId, dayOfWeek: dayName as (typeof WORKING_DAYS)[number], isBreak: false, subjectId: { not: null } },
        select: { periodIndex: true, subjectId: true, facultyId: true },
        orderBy: { periodIndex: 'asc' },
      });
      for (const slot of slots) {
        const [startTime, endTime] = DAY_TIMES[slot.periodIndex] ?? ['09:00', '09:50'];
        const session = await prisma.attendanceSession.create({
          data: {
            date: iso(day),
            periodIndex: slot.periodIndex,
            startTime,
            endTime,
            durationMinutes: 50,
            status: 'COMPLETED',
            subjectId: slot.subjectId as string,
            classId: classById[c.key].id,
            facultyId: slot.facultyId,
            totalStudents: studentByClass[c.key]?.length ?? 0,
          },
        });
        let present = 0;
        let absent = 0;
        const records: Prisma.AttendanceRecordCreateManyInput[] = [];
        for (const st of studentByClass[c.key] ?? []) {
          const r = rand();
          let status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' = 'PRESENT';
          if (r > st.attendanceBias + 0.05) status = 'ABSENT';
          else if (r > st.attendanceBias) status = 'EXCUSED';
          else if (chance(0.05)) status = 'LATE';
          records.push({ sessionId: session.id, studentId: st.id, status });
          if (status === 'PRESENT' || status === 'LATE' || status === 'EXCUSED') present += 1;
          else absent += 1;
        }
        if (records.length) await prisma.attendanceRecord.createMany({ data: records });
        await prisma.attendanceSession.update({ where: { id: session.id }, data: { presentCount: present, absentCount: absent } });
      }
    }
  }

  // ── IA exams & marks (IA-1, IA-2 for every class with a curriculum) ───
  console.log('→ IA exams & marks…');
  const ia1Date = iso(new Date('2026-09-10'));
  const ia2Date = iso(new Date('2026-09-28'));
  for (const c of CLASSES) {
    if (c.subjectCodes.length === 0) continue;
    for (const code of c.subjectCodes) {
      for (const [examNumber, examDate] of [
        [1, ia1Date],
        [2, ia2Date],
      ] as const) {
        const exam = await prisma.iAExam.create({
          data: {
            name: `IA-${examNumber}`,
            examNumber,
            examDate,
            maxMarks: 50,
            subjectId: subjects[code].id,
            classId: classById[c.key].id,
            facultyId: facultyForSubject[code] ?? null,
          },
        });
        for (const st of studentByClass[c.key] ?? []) {
          const isAbsent = chance(0.03);
          const base = st.cgpaBase * 6; // ~41-58 out of 50
          const marks = isAbsent ? 0 : Math.min(50, Math.max(5, Math.round(base + rand() * 12 - 4 + examNumber * 1.5)));
          await prisma.iAMark.create({
            data: { iaExamId: exam.id, studentId: st.id, marks, isAbsent, remarks: isAbsent ? 'Absent' : null },
          });
        }
      }
    }
  }

  // ── University results (two past semesters for CSE Y3) ────────────────
  console.log('→ University results & arrears…');
  const GRADES: { grade: string; points: number }[] = [
    { grade: 'A+', points: 10 }, { grade: 'A', points: 9 }, { grade: 'B+', points: 8 },
    { grade: 'B', points: 7 }, { grade: 'C', points: 6 },
  ];
  const cseStudents = (studentByClass['CSE3A'] ?? []).concat(studentByClass['CSE3B'] ?? []);
  const cseSubjects = CLASSES.find((c) => c.key === 'CSE3A')!.subjectCodes.filter((s) => s !== 'CS591');

  const resultDefs = [
    { name: 'Semester 3 · November 2024', semester: 3, declared: iso(new Date('2025-01-20')) },
    { name: 'Semester 4 · May 2025', semester: 4, declared: iso(new Date('2025-08-12')) },
  ];
  const gpas: Record<string, number[]> = {};
  for (const rd of resultDefs) {
    const universityResult = await prisma.universityResult.create({
      data: {
        name: rd.name,
        semester: rd.semester,
        declaredOn: rd.declared,
        status: 'COMPLETED',
        departmentId: departments.CSE.id,
        academicYearId: yearPast.id,
        processedById: faculty['FAC-CSE-01'].id,
        totalStudents: cseStudents.length,
      },
    });
    let passed = 0;
    let failed = 0;
    let arrearCount = 0;
    for (const st of cseStudents) {
      const sr = await prisma.studentResult.create({
        data: { universityResultId: universityResult.id, studentId: st.id, semester: rd.semester, status: 'PENDING' },
      });
      let gpaSum = 0;
      let credits = 0;
      let fails = 0;
      for (const code of cseSubjects) {
        const fail = chance(0.08) && st.cgpaBase < 7.6;
        const { grade, points } = fail ? { grade: 'F', points: 0 } : pick(GRADES);
        const marks = fail ? randInt(28, 44) : randInt(45, 92);
        await prisma.universityResultSubject.create({
          data: {
            studentResultId: sr.id,
            subjectId: subjects[code].id,
            grade: fail ? 'F' : grade,
            marks,
            credits: subjects[code].def.credits,
            status: fail ? 'FAIL' : 'PASS',
            attempts: 1,
          },
        });
        if (fail) {
          fails += 1;
          arrearCount += 1;
          await prisma.arrear.create({
            data: {
              studentId: st.id,
              subjectId: subjects[code].id,
              semester: rd.semester,
              status: 'OPEN',
              firstAttempt: rd.declared,
              attempts: 1,
            },
          });
        }
        gpaSum += points * subjects[code].def.credits;
        credits += subjects[code].def.credits;
      }
      const gpa = credits ? gpaSum / credits : 0;
      (gpas[st.id] ??= []).push(gpa);
      if (fails > 0) {
        failed += 1;
        await prisma.studentResult.update({ where: { id: sr.id }, data: { status: 'FAIL', arrearsCount: fails, gpa, aggregate: gpaSum } });
      } else {
        passed += 1;
        await prisma.studentResult.update({ where: { id: sr.id }, data: { status: 'PASS', gpa, aggregate: gpaSum } });
      }
    }
    // Clear a few arrears from semester 3 after the semester-4 retakes
    if (rd.semester === 4) {
      const open = await prisma.arrear.findMany({ where: { status: 'OPEN', semester: 3 } });
      for (const a of open.slice(0, Math.ceil(open.length / 2))) {
        await prisma.arrear.update({ where: { id: a.id }, data: { status: 'CLEARED', clearedAt: rd.declared, attempts: 2 } });
      }
    }
    const passPct = Math.round((passed / Math.max(cseStudents.length, 1)) * 1000) / 10;
    await prisma.universityResult.update({
      where: { id: universityResult.id },
      data: { passedStudents: passed, failedStudents: failed, arrearCount, passPercentage: passPct },
    });
  }

  // CGPA from results where available, otherwise the base
  for (const st of students) {
    const list = gpas[st.id];
    const cgpa = list ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100 : Math.round(st.cgpaBase * 100) / 100;
    await prisma.student.update({ where: { id: st.id }, data: { cgpa } });
  }

  // ── Career: skills taxonomy, resumes, jobs, matches ───────────────────
  console.log('→ Career data…');
  const skillIds: Record<string, string> = {};
  for (const s of SKILL_TAXONOMY) {
    skillIds[s.name] = (await prisma.skill.upsert({ where: { name: s.name }, update: { category: s.category, aliases: s.aliases, demand: s.demand }, create: { name: s.name, category: s.category, aliases: s.aliases, demand: s.demand } })).id;
  }

  const arjun = students.find((s) => s.register === '24CS001') ?? cseStudents[0];
  const diya = cseStudents[1] ?? cseStudents[0];

  const arjunResume = await prisma.resume.create({
    data: {
      studentId: arjun.id,
      title: 'Arjun Nair — Placement Resume 2027',
      content: ARJUN_RESUME,
      version: 1,
      isPrimary: true,
      wordCount: ARJUN_RESUME.split(/\s+/).length,
    },
  });
  const arjunResumeAnalysis = await ai.analyzeResume(ARJUN_RESUME);
  await prisma.resume.update({ where: { id: arjunResume.id }, data: { parsedData: arjunResumeAnalysis as unknown as Prisma.InputJsonValue } });
  await prisma.resumeAnalysis.create({
    data: { resumeId: arjunResume.id, provider: 'MOCK', summary: arjunResumeAnalysis as unknown as Prisma.InputJsonValue, durationMs: arjunResumeAnalysis.durationMs },
  });
  const arjunSkillNames = ['Python', 'Django', 'REST API', 'PostgreSQL', 'Redis', 'Docker', 'Git', 'Linux', 'React', 'TypeScript', 'JavaScript', 'SQL', 'Microservices'];
  await prisma.resumeSkill.createMany({
    data: arjunSkillNames
      .filter((n) => skillIds[n])
      .map((n, i) => ({
        resumeId: arjunResume.id,
        skillId: skillIds[n],
        mentions: randInt(2, 6),
        evidence: ARJUN_RESUME.split('\n').find((line) => line.toLowerCase().includes(n.toLowerCase().split(' ')[0])) ?? null,
      })),
  });

  const diyaResume = await prisma.resume.create({
    data: { studentId: diya.id, title: 'Diya Sharma — Analytics Resume', content: DIYA_RESUME, version: 1, isPrimary: true, wordCount: DIYA_RESUME.split(/\s+/).length },
  });
  const diyaAnalysis = await ai.analyzeResume(DIYA_RESUME);
  await prisma.resume.update({ where: { id: diyaResume.id }, data: { parsedData: diyaAnalysis as unknown as Prisma.InputJsonValue } });
  await prisma.resumeAnalysis.create({ data: { resumeId: diyaResume.id, provider: 'MOCK', summary: diyaAnalysis as unknown as Prisma.InputJsonValue, durationMs: diyaAnalysis.durationMs } });

  const jobDefs = [
    { title: 'Backend Software Engineer', company: 'Zoho Corporation', location: 'Chennai', jd: ZOHo_JD, student: arjun.id, jobType: 'HYBRID' as const, url: 'https://careers.zohocorp.com/backend' },
    { title: 'Software Engineer – Data', company: 'TCS', location: 'Coimbatore', jd: TCS_JD, student: arjun.id, jobType: 'ON_SITE' as const, url: 'https://www.tcs.com/careers' },
    { title: 'Associate Product Manager', company: 'Freshworks', location: 'Coimbatore', jd: PRODUCT_JD, student: diya.id, jobType: 'HYBRID' as const, url: 'https://www.freshworks.com/careers/' },
  ];
  const jobs: { id: string; def: (typeof jobDefs)[number] }[] = [];
  for (const j of jobDefs) {
    const analysis = await ai.analyzeJobDescription(j.jd);
    const job = await prisma.jobDescription.create({
      data: {
        title: j.title,
        company: j.company,
        location: j.location,
        jobType: j.jobType,
        sourceUrl: j.url,
        description: j.jd,
        minExperience: analysis.experienceYears,
        wordCount: j.jd.split(/\s+/).length,
        parsedData: analysis as unknown as Prisma.InputJsonValue,
        studentId: j.student,
      },
    });
    await prisma.jobAnalysis.create({ data: { jobDescriptionId: job.id, provider: 'MOCK', summary: analysis as unknown as Prisma.InputJsonValue, durationMs: analysis.durationMs } });
    jobs.push({ id: job.id, def: j });
  }

  const matchDefs = [
    { resume: arjunResume, job: jobs[0], student: arjun },
    { resume: arjunResume, job: jobs[1], student: arjun },
    { resume: diyaResume, job: jobs[2], student: diya },
  ];
  for (const m of matchDefs) {
    const result = await ai.matchResumeToJob(m.resume.content, m.job.def.jd);
    const match = await prisma.resumeJobMatch.create({
      data: {
        resumeId: m.resume.id,
        jobDescriptionId: m.job.id,
        studentId: m.student.id,
        score: result.score,
        verdict: result.verdict,
        provider: 'MOCK',
        model: null,
        matchedSkills: result.matchedSkills as unknown as Prisma.InputJsonValue,
        missingSkills: result.missingSkills as unknown as Prisma.InputJsonValue,
        partialSkills: result.partialSkills as unknown as Prisma.InputJsonValue,
        resumeEvidence: result.evidence as unknown as Prisma.InputJsonValue,
        gapAnalysis: { breakdown: result.breakdown, summary: result.summary } as unknown as Prisma.InputJsonValue,
        recommendations: result.recommendations as unknown as Prisma.InputJsonValue,
        breakdown: result.breakdown as unknown as Prisma.InputJsonValue,
        disclaimer: result.disclaimer,
        durationMs: result.durationMs,
      },
    });
    for (const skill of result.missingSkills.slice(0, 12)) {
      const recommendation = result.recommendations.find((r) => r.skill === skill.name);
      await prisma.skillGap.create({
        data: {
          matchId: match.id,
          studentId: m.student.id,
          skillName: skill.name,
          skillId: skillIds[skill.name] ?? null,
          severity: skill.demand >= 4 ? 'HIGH' : skill.demand >= 3 ? 'MEDIUM' : 'LOW',
          category: skill.category,
          recommendation: recommendation?.detail ?? recommendation?.title ?? null,
          status: 'OPEN',
        },
      });
    }
  }

  // ── Notifications ──────────────────────────────────────────────────────
  console.log('→ Notifications…');
  await prisma.notification.createMany({
    data: [
      { userId: arjun.userId, type: 'CAREER_INSIGHT', title: 'Resume match: 78% for Backend Software Engineer', message: 'Your resume is missing 4 skills this job asks for: Celery, Kubernetes, Message Queues, Flask.', link: '/career', isRead: false },
      { userId: arjun.userId, type: 'RESULT_PUBLISHED', title: 'Semester 4 results are out', message: 'Your university result for semester 4 (May 2025) has been published.', link: '/results', isRead: true },
      { userId: arjun.userId, type: 'ATTENDANCE_ALERT', title: 'Attendance dropped below 80% in CS502', message: 'You are at 74.2% in Database Management Systems. Attend 6 more classes to return to safe.', link: '/attendance', isRead: false },
      { userId: diya.userId, type: 'CAREER_INSIGHT', title: 'Resume match: 64% for Associate Product Manager', message: 'Strong SQL and Python base — work on A/B testing experience to close the gap.', link: '/career', isRead: false },
      { userId: faculty['FAC-CSE-01'].userId, type: 'TIMETABLE_UPDATED', title: 'CSE Year 3 Section A timetable published', message: 'The week-A timetable was generated with 0 conflicts.', link: '/timetable', isRead: true },
      { userId: faculty['FAC-CSE-01'].userId, type: 'ATTENDANCE_ALERT', title: '3 students below the debar line in CS501', message: 'Check the at-risk list before Friday’s class.', link: '/attendance', isRead: false },
      { userId: adminUser.id, type: 'SYSTEM', title: 'Weekly digest ready', message: '14 students at risk, 9 open arrears, 4 timetables published this week.', link: '/analytics', isRead: false },
      { userId: adminUser.id, type: 'RESULT_PUBLISHED', title: 'Semester 4 university result processed', message: '27 student results ingested — 4 students have open arrears.', link: '/results', isRead: true },
    ],
  });

  // ── Audit trail for the seeded actions ─────────────────────────────────
  console.log('→ Audit log…');
  await prisma.auditLog.createMany({
    data: [
      { action: 'seed.run', resourceType: 'System', description: 'Seeded demo institution: 1 admin, 5 faculty, 59 students', userId: adminUser.id, ipAddress: '127.0.0.1', userAgent: 'CampusIQ Seed' },
      { action: 'settings.update', resourceType: 'SystemSetting', description: 'Set attendance thresholds 80/75/70', newValue: { safe: 80, fine: 75, debar: 70 }, userId: adminUser.id, ipAddress: '127.0.0.1', userAgent: 'CampusIQ Seed' },
      { action: 'timetable.publish', resourceType: 'Timetable', resourceId: timetableIds['CSE3A'] ?? null, description: 'Published CSE Year 3 Section A timetable (0 conflicts)', userId: faculty['FAC-CSE-01'].userId, ipAddress: '127.0.0.1', userAgent: 'CampusIQ Seed' },
      { action: 'result.process', resourceType: 'UniversityResult', description: 'Processed semester 4 university result for 27 students', userId: faculty['FAC-CSE-01'].userId, ipAddress: '127.0.0.1', userAgent: 'CampusIQ Seed' },
      { action: 'career.match', resourceType: 'ResumeJobMatch', description: `Matched Arjun's resume against Zoho backend role`, userId: arjun.userId, ipAddress: '127.0.0.1', userAgent: 'CampusIQ Seed' },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    students: await prisma.student.count(),
    faculty: await prisma.faculty.count(),
    subjects: await prisma.subject.count(),
    classes: await prisma.class.count(),
    sessions: await prisma.attendanceSession.count(),
    records: await prisma.attendanceRecord.count(),
    iaMarks: await prisma.iAMark.count(),
    results: await prisma.universityResult.count(),
    timetables: await prisma.timetable.count(),
    resumes: await prisma.resume.count(),
    matches: await prisma.resumeJobMatch.count(),
  };
  console.log('✔ Seed complete:', counts);
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
