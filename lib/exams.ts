export interface Question {
  id: string;
  text: string;
  keywords: string[];
  timeLimit: number;
}

export type ExamStatus = 'draft' | 'published' | 'completed';

export interface Exam {
  id: string;
  code: string;
  title: string;
  subject: string;
  description: string;
  questions: Question[];
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

const seedExams: Exam[] = [
  {
    id: 'exam-1',
    code: 'SPK-2A8F',
    title: 'English Speaking Assessment',
    subject: 'English',
    description: 'End of semester oral assessment covering everyday conversation, fluency and pronunciation.',
    status: 'completed',
    createdAt: '2026-07-28T10:00:00.000Z',
    studentCount: 32,
    averageScore: 87,
    questions: [
      { id: 'q1', text: 'Tell me about your daily routine.', keywords: ['morning', 'work', 'evening'], timeLimit: 60 },
      { id: 'q2', text: 'Describe your favorite hobby.', keywords: ['enjoy', 'practice', 'free time'], timeLimit: 60 },
    ],
  },
  {
    id: 'exam-2',
    code: 'SCI-1B9C',
    title: 'Science Oral Quiz - Grade 8',
    subject: 'Science',
    description: 'Short oral quiz on photosynthesis and plant biology.',
    status: 'published',
    createdAt: '2026-08-02T09:30:00.000Z',
    studentCount: 14,
    averageScore: 78,
    questions: [
      { id: 'q1', text: 'Explain the process of photosynthesis.', keywords: ['light', 'energy', 'chlorophyll'], timeLimit: 90 },
    ],
  },
  {
    id: 'exam-3',
    code: 'HIS-3D4E',
    title: 'History Presentation - WW2',
    subject: 'History',
    description: 'Oral presentation assessment on key events of World War II.',
    status: 'draft',
    createdAt: '2026-08-05T14:00:00.000Z',
    studentCount: 0,
    averageScore: 0,
    questions: [
      { id: 'q1', text: 'Summarize the causes of World War II.', keywords: ['treaty', 'economy', 'invasion'], timeLimit: 120 },
    ],
  },
];

export function getExams(): Exam[] {
  if (typeof window === 'undefined') return seedExams;
  try {
    const raw = window.localStorage.getItem(EXAMS_KEY);
    if (!raw) return seedExams;
    return JSON.parse(raw) as Exam[];
  } catch {
    return seedExams;
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
