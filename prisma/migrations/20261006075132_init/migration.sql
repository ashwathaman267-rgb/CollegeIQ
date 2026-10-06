-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'FACULTY', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('THEORY', 'LABORATORY', 'ELECTIVE', 'PROJECT', 'SEMINAR');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('CLASSROOM', 'LABORATORY', 'AUDITORIUM', 'SEMINAR_HALL');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PASS', 'FAIL', 'ARREAR', 'CLEARED', 'ABSENT');

-- CreateEnum
CREATE TYPE "StudentResultStatus" AS ENUM ('PASS', 'PASS_WITH_ARREARS', 'FAIL', 'PENDING');

-- CreateEnum
CREATE TYPE "ArrearStatus" AS ENUM ('OPEN', 'CLEARED');

-- CreateEnum
CREATE TYPE "TimetableStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConstraintType" AS ENUM ('FACULTY_CONFLICT', 'ROOM_CONFLICT', 'LABORATORY_CONFLICT', 'WEEKLY_REQUIREMENT', 'BREAK_PROTECTION', 'DISTRIBUTION', 'MAX_CONSECUTIVE', 'LAB_CONTIGUOUS', 'AVAILABILITY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ConstraintSeverity" AS ENUM ('HARD', 'SOFT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ATTENDANCE_ALERT', 'RESULT_PUBLISHED', 'TIMETABLE_UPDATED', 'CAREER_INSIGHT', 'ACADEMIC', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('RESUME', 'JOB_DESCRIPTION', 'RESULT_SHEET', 'MARKS_SHEET', 'AVATAR', 'OTHER');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('PROGRAMMING_LANGUAGE', 'FRAMEWORK', 'LIBRARY', 'TOOL', 'DATABASE', 'CLOUD', 'PLATFORM', 'DOMAIN', 'SOFT_SKILL', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "AnalysisProvider" AS ENUM ('MOCK', 'GEMINI', 'OPENAI', 'CUSTOM');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT', 'REMOTE', 'ON_SITE', 'HYBRID');

-- CreateEnum
CREATE TYPE "MatchVerdict" AS ENUM ('EXCELLENT', 'STRONG', 'MODERATE', 'WEAK', 'POOR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "themePreference" TEXT NOT NULL DEFAULT 'system',
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "building" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "headOfDepartmentId" TEXT,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "departmentId" TEXT,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "yearOfStudy" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "semester" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "departmentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "subjectType" "SubjectType" NOT NULL DEFAULT 'THEORY',
    "semester" INTEGER NOT NULL DEFAULT 1,
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "weeklyPeriods" INTEGER NOT NULL DEFAULT 4,
    "periodsPerSession" INTEGER NOT NULL DEFAULT 1,
    "maxIaMarks" INTEGER NOT NULL DEFAULT 50,
    "maxTheoryMarks" INTEGER NOT NULL DEFAULT 100,
    "passMarks" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_subjects" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_subjects" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculty_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 60,
    "roomType" "RoomType" NOT NULL DEFAULT 'CLASSROOM',
    "building" TEXT,
    "floor" INTEGER,
    "hasProjector" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "departmentId" TEXT,
    "laboratoryId" TEXT,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laboratories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "equipment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "laboratories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "registerNumber" TEXT NOT NULL,
    "rollNumber" TEXT,
    "admissionYear" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL DEFAULT 1,
    "gender" "Gender" NOT NULL DEFAULT 'UNSPECIFIED',
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "city" TEXT,
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "bloodGroup" TEXT,
    "cgpa" DOUBLE PRECISION,
    "batch" TEXT,
    "academicStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "classId" TEXT,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "designation" TEXT NOT NULL DEFAULT 'Assistant Professor',
    "specialization" TEXT,
    "qualification" TEXT,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "gender" "Gender" NOT NULL DEFAULT 'UNSPECIFIED',
    "joinedOn" TIMESTAMP(3),
    "academicStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT,
    "academicYearId" TEXT,
    "semester" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ENROLLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_availability" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 50,
    "status" "SessionStatus" NOT NULL DEFAULT 'COMPLETED',
    "topic" TEXT,
    "notes" TEXT,
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "presentCount" INTEGER NOT NULL DEFAULT 0,
    "absentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "facultyId" TEXT,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "remarks" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_exams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examNumber" INTEGER NOT NULL DEFAULT 1,
    "examDate" DATE NOT NULL,
    "maxMarks" INTEGER NOT NULL DEFAULT 50,
    "weightage" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "facultyId" TEXT,

    CONSTRAINT "ia_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_marks" (
    "id" TEXT NOT NULL,
    "iaExamId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marks" INTEGER NOT NULL DEFAULT 0,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_results" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "declaredOn" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "passPercentage" DOUBLE PRECISION,
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "passedStudents" INTEGER NOT NULL DEFAULT 0,
    "failedStudents" INTEGER NOT NULL DEFAULT 0,
    "arrearCount" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "departmentId" TEXT,
    "academicYearId" TEXT,
    "fileAssetId" TEXT,
    "processedById" TEXT,

    CONSTRAINT "university_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_results" (
    "id" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "gpa" DOUBLE PRECISION,
    "aggregate" DOUBLE PRECISION,
    "arrearsCount" INTEGER NOT NULL DEFAULT 0,
    "status" "StudentResultStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "universityResultId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "student_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_result_subjects" (
    "id" TEXT NOT NULL,
    "grade" TEXT,
    "marks" INTEGER,
    "credits" DOUBLE PRECISION,
    "status" "ResultStatus" NOT NULL DEFAULT 'PASS',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "studentResultId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "university_result_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arrears" (
    "id" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "status" "ArrearStatus" NOT NULL DEFAULT 'OPEN',
    "firstAttempt" DATE NOT NULL,
    "clearedAt" DATE,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "arrears_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetables" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "TimetableStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "conflicts" JSONB,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "generatedById" TEXT,

    CONSTRAINT "timetables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    "breakLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "timetableId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT,
    "facultyId" TEXT,
    "roomId" TEXT,
    "laboratoryId" TEXT,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_constraints" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ConstraintType" NOT NULL,
    "severity" "ConstraintSeverity" NOT NULL DEFAULT 'HARD',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduling_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL DEFAULT 'TOOL',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "demand" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'My Resume',
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "parsedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "studentId" TEXT NOT NULL,
    "fileAssetId" TEXT,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_skills" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "evidence" TEXT,
    "mentions" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "resume_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_descriptions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "location" TEXT,
    "jobType" "JobType" NOT NULL DEFAULT 'FULL_TIME',
    "description" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "minExperience" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "parsedData" JSONB,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "studentId" TEXT,
    "fileAssetId" TEXT,

    CONSTRAINT "job_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_analyses" (
    "id" TEXT NOT NULL,
    "provider" "AnalysisProvider" NOT NULL DEFAULT 'MOCK',
    "model" TEXT,
    "summary" JSONB NOT NULL,
    "rawResponse" JSONB,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumeId" TEXT NOT NULL,

    CONSTRAINT "resume_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_analyses" (
    "id" TEXT NOT NULL,
    "provider" "AnalysisProvider" NOT NULL DEFAULT 'MOCK',
    "model" TEXT,
    "summary" JSONB NOT NULL,
    "rawResponse" JSONB,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobDescriptionId" TEXT NOT NULL,

    CONSTRAINT "job_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_job_matches" (
    "id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "verdict" "MatchVerdict" NOT NULL DEFAULT 'MODERATE',
    "provider" "AnalysisProvider" NOT NULL DEFAULT 'MOCK',
    "model" TEXT,
    "matchedSkills" JSONB NOT NULL,
    "missingSkills" JSONB NOT NULL,
    "partialSkills" JSONB,
    "resumeEvidence" JSONB,
    "gapAnalysis" JSONB,
    "recommendations" JSONB,
    "breakdown" JSONB,
    "disclaimer" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "resumeId" TEXT NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "resume_job_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_gaps" (
    "id" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "recommendation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "matchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT,
    "subjectId" TEXT,

    CONSTRAINT "skill_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageDriver" TEXT NOT NULL DEFAULT 'local',
    "checksum" TEXT,
    "kind" "FileKind" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "ownerId" TEXT,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "description" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_name_key" ON "academic_years"("name");

-- CreateIndex
CREATE INDEX "academic_years_isCurrent_idx" ON "academic_years"("isCurrent");

-- CreateIndex
CREATE INDEX "classes_academicYearId_idx" ON "classes"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "classes_departmentId_academicYearId_yearOfStudy_section_key" ON "classes"("departmentId", "academicYearId", "yearOfStudy", "section");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE INDEX "subjects_departmentId_semester_idx" ON "subjects"("departmentId", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "class_subjects_classId_subjectId_key" ON "class_subjects"("classId", "subjectId");

-- CreateIndex
CREATE INDEX "faculty_subjects_subjectId_idx" ON "faculty_subjects"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_subjects_facultyId_subjectId_classId_key" ON "faculty_subjects"("facultyId", "subjectId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");

-- CreateIndex
CREATE INDEX "rooms_roomType_idx" ON "rooms"("roomType");

-- CreateIndex
CREATE UNIQUE INDEX "laboratories_code_key" ON "laboratories"("code");

-- CreateIndex
CREATE INDEX "laboratories_departmentId_idx" ON "laboratories"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "students_registerNumber_key" ON "students"("registerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");

-- CreateIndex
CREATE INDEX "students_departmentId_classId_idx" ON "students"("departmentId", "classId");

-- CreateIndex
CREATE INDEX "students_academicStatus_idx" ON "students"("academicStatus");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_employeeId_key" ON "faculty"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_userId_key" ON "faculty"("userId");

-- CreateIndex
CREATE INDEX "faculty_departmentId_idx" ON "faculty"("departmentId");

-- CreateIndex
CREATE INDEX "enrollments_subjectId_classId_idx" ON "enrollments"("subjectId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_studentId_subjectId_academicYearId_key" ON "enrollments"("studentId", "subjectId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_availability_facultyId_dayOfWeek_periodIndex_key" ON "faculty_availability"("facultyId", "dayOfWeek", "periodIndex");

-- CreateIndex
CREATE INDEX "attendance_sessions_classId_date_idx" ON "attendance_sessions"("classId", "date");

-- CreateIndex
CREATE INDEX "attendance_sessions_date_idx" ON "attendance_sessions"("date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_subjectId_classId_date_periodIndex_key" ON "attendance_sessions"("subjectId", "classId", "date", "periodIndex");

-- CreateIndex
CREATE INDEX "attendance_records_studentId_status_idx" ON "attendance_records"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_sessionId_studentId_key" ON "attendance_records"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "ia_exams_classId_idx" ON "ia_exams"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "ia_exams_subjectId_classId_examNumber_key" ON "ia_exams"("subjectId", "classId", "examNumber");

-- CreateIndex
CREATE INDEX "ia_marks_studentId_idx" ON "ia_marks"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ia_marks_iaExamId_studentId_key" ON "ia_marks"("iaExamId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "university_results_fileAssetId_key" ON "university_results"("fileAssetId");

-- CreateIndex
CREATE INDEX "university_results_semester_idx" ON "university_results"("semester");

-- CreateIndex
CREATE INDEX "student_results_studentId_semester_idx" ON "student_results"("studentId", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "student_results_universityResultId_studentId_key" ON "student_results"("universityResultId", "studentId");

-- CreateIndex
CREATE INDEX "university_result_subjects_subjectId_status_idx" ON "university_result_subjects"("subjectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "university_result_subjects_studentResultId_subjectId_key" ON "university_result_subjects"("studentResultId", "subjectId");

-- CreateIndex
CREATE INDEX "arrears_status_idx" ON "arrears"("status");

-- CreateIndex
CREATE UNIQUE INDEX "arrears_studentId_subjectId_semester_key" ON "arrears"("studentId", "subjectId", "semester");

-- CreateIndex
CREATE INDEX "timetables_academicYearId_status_idx" ON "timetables"("academicYearId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "timetables_classId_academicYearId_version_key" ON "timetables"("classId", "academicYearId", "version");

-- CreateIndex
CREATE INDEX "timetable_slots_classId_dayOfWeek_periodIndex_idx" ON "timetable_slots"("classId", "dayOfWeek", "periodIndex");

-- CreateIndex
CREATE INDEX "timetable_slots_facultyId_dayOfWeek_periodIndex_idx" ON "timetable_slots"("facultyId", "dayOfWeek", "periodIndex");

-- CreateIndex
CREATE INDEX "timetable_slots_roomId_dayOfWeek_periodIndex_idx" ON "timetable_slots"("roomId", "dayOfWeek", "periodIndex");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_timetableId_dayOfWeek_periodIndex_key" ON "timetable_slots"("timetableId", "dayOfWeek", "periodIndex");

-- CreateIndex
CREATE UNIQUE INDEX "scheduling_constraints_name_key" ON "scheduling_constraints"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE INDEX "skills_category_idx" ON "skills"("category");

-- CreateIndex
CREATE UNIQUE INDEX "resumes_fileAssetId_key" ON "resumes"("fileAssetId");

-- CreateIndex
CREATE INDEX "resumes_studentId_idx" ON "resumes"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "resume_skills_resumeId_skillId_key" ON "resume_skills"("resumeId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "job_descriptions_fileAssetId_key" ON "job_descriptions"("fileAssetId");

-- CreateIndex
CREATE INDEX "job_descriptions_title_idx" ON "job_descriptions"("title");

-- CreateIndex
CREATE INDEX "resume_analyses_resumeId_idx" ON "resume_analyses"("resumeId");

-- CreateIndex
CREATE INDEX "job_analyses_jobDescriptionId_idx" ON "job_analyses"("jobDescriptionId");

-- CreateIndex
CREATE INDEX "resume_job_matches_studentId_createdAt_idx" ON "resume_job_matches"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "skill_gaps_studentId_status_idx" ON "skill_gaps"("studentId", "status");

-- CreateIndex
CREATE INDEX "skill_gaps_skillId_idx" ON "skill_gaps"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_storageKey_key" ON "file_assets"("storageKey");

-- CreateIndex
CREATE INDEX "file_assets_ownerId_kind_idx" ON "file_assets"("ownerId", "kind");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_headOfDepartmentId_fkey" FOREIGN KEY ("headOfDepartmentId") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_subjects" ADD CONSTRAINT "faculty_subjects_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_subjects" ADD CONSTRAINT "faculty_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "laboratories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboratories" ADD CONSTRAINT "laboratories_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty" ADD CONSTRAINT "faculty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty" ADD CONSTRAINT "faculty_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_availability" ADD CONSTRAINT "faculty_availability_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_exams" ADD CONSTRAINT "ia_exams_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_exams" ADD CONSTRAINT "ia_exams_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_exams" ADD CONSTRAINT "ia_exams_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_marks" ADD CONSTRAINT "ia_marks_iaExamId_fkey" FOREIGN KEY ("iaExamId") REFERENCES "ia_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_marks" ADD CONSTRAINT "ia_marks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_results" ADD CONSTRAINT "university_results_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_results" ADD CONSTRAINT "university_results_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_results" ADD CONSTRAINT "university_results_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_results" ADD CONSTRAINT "university_results_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_results" ADD CONSTRAINT "student_results_universityResultId_fkey" FOREIGN KEY ("universityResultId") REFERENCES "university_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_results" ADD CONSTRAINT "student_results_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_result_subjects" ADD CONSTRAINT "university_result_subjects_studentResultId_fkey" FOREIGN KEY ("studentResultId") REFERENCES "student_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_result_subjects" ADD CONSTRAINT "university_result_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arrears" ADD CONSTRAINT "arrears_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arrears" ADD CONSTRAINT "arrears_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "timetables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "laboratories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_skills" ADD CONSTRAINT "resume_skills_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_skills" ADD CONSTRAINT "resume_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_analyses" ADD CONSTRAINT "resume_analyses_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_job_matches" ADD CONSTRAINT "resume_job_matches_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_job_matches" ADD CONSTRAINT "resume_job_matches_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_job_matches" ADD CONSTRAINT "resume_job_matches_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_gaps" ADD CONSTRAINT "skill_gaps_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "resume_job_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_gaps" ADD CONSTRAINT "skill_gaps_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_gaps" ADD CONSTRAINT "skill_gaps_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_gaps" ADD CONSTRAINT "skill_gaps_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
