export type ExamType = 'audio' | 'video' | 'audio_video' | 'mcq' | 'essay';

export interface Question {
  id: string;
  text: string;
  keywords: string[];
  timeLimit: number;
  options?: string[];
  modelAnswer?: string;
}

export interface ModelVariant {
  id: string;
  name: string;
  questions: Question[];
}

export type ExamStatus = 'draft' | 'published' | 'completed';

export interface Exam {
  id: string;
  code: string;
  title: string;
  type?: ExamType;
  subject: string;
  description: string;
  questions: Question[];
  models?: ModelVariant[];
  status: ExamStatus;
  createdAt: string;
  studentCount: number;
  averageScore: number;
}

export interface StudentResult {
  id: string;
  examId: string;
  name: string;
  score: number;
  submittedAt: string;
}

const EXAMS_KEY = 'examly_exams';
const RESULTS_KEY = 'examly_results';
const DATA_VERSION_KEY = 'examly_data_version';
const CURRENT_DATA_VERSION = '3'; // Bump this when seed data schema changes

function ensureDataVersion(): void {
  if (typeof window === 'undefined') return;
  const storedVersion = window.localStorage.getItem(DATA_VERSION_KEY);
  if (storedVersion !== CURRENT_DATA_VERSION) {
    // Clear stale data so seed exams (with type field) are used
    window.localStorage.removeItem(EXAMS_KEY);
    window.localStorage.removeItem(RESULTS_KEY);
    window.localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
  }
}

const seedExams: Exam[] = [];

export function getExams(): Exam[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(EXAMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Exam[];
  } catch {
    return [];
  }
}

export function saveExams(exams: Exam[]): void {
  window.localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
}

export function getExamByCode(code: string): Exam | undefined {
  return getExams().find((exam) => exam.code.toLowerCase() === code.toLowerCase());
}

export function getExamById(id: string): Exam | undefined {
  return getExams().find((exam) => exam.id === id);
}

export function createExam(data: Omit<Exam, 'id' | 'code' | 'createdAt' | 'studentCount' | 'averageScore'>): Exam {
  const exams = getExams();
  const exam: Exam = {
    ...data,
    id: `exam-${Date.now()}`,
    code: generateCode(),
    createdAt: new Date().toISOString(),
    studentCount: 0,
    averageScore: 0,
  };
  saveExams([exam, ...exams]);
  return exam;
}

export function deleteExam(id: string): void {
  saveExams(getExams().filter((exam) => exam.id !== id));
  window.localStorage.setItem(
    RESULTS_KEY,
    JSON.stringify(getResults().filter((result) => result.examId !== id))
  );
}

export function generateCode(): string {
  const prefix = 'EXM';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${suffix}`;
}

export function getResults(): StudentResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RESULTS_KEY);
    return raw ? (JSON.parse(raw) as StudentResult[]) : [];
  } catch {
    return [];
  }
}

export function addResult(result: Omit<StudentResult, 'id'>): void {
  const results = getResults();
  const full: StudentResult = { ...result, id: `result-${Date.now()}` };
  window.localStorage.setItem(RESULTS_KEY, JSON.stringify([full, ...results]));

  const exams = getExams();
  const updated = exams.map((exam) => {
    if (exam.id !== result.examId) return exam;
    const all = [full, ...results.filter((r) => r.examId === result.examId)];
    const avg = all.reduce((sum, r) => sum + r.score, 0) / all.length;
    return {
      ...exam,
      studentCount: all.length,
      averageScore: Math.round(avg),
      status: 'completed' as ExamStatus,
    };
  });
  saveExams(updated);
}
