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

const seedExams: Exam[] = [
  {
    id: 'exam-1',
    code: 'SPK-2A8F',
    title: 'English Speaking Assessment',
    type: 'audio',
    subject: 'English',
    description: 'End of semester oral assessment covering everyday conversation, fluency and pronunciation.',
    status: 'completed',
    createdAt: '2026-07-28T10:00:00.000Z',
    studentCount: 32,
    averageScore: 87,
    questions: [
      { id: 'q1', text: 'Tell me about your daily routine.', keywords: ['morning', 'work', 'evening'], timeLimit: 60, modelAnswer: 'Student should detail their morning routine, workday/school activities, and evening relaxation.' },
      { id: 'q2', text: 'Describe your favorite hobby.', keywords: ['enjoy', 'practice', 'free time'], timeLimit: 60, modelAnswer: 'Student should mention what the hobby is, why they enjoy it, and how often they practice.' },
    ],
    models: [
      {
        id: 'model-a',
        name: 'Model A',
        questions: [
          { id: 'q1', text: 'Tell me about your daily routine.', keywords: ['morning', 'work', 'evening'], timeLimit: 60, modelAnswer: 'Student should detail their morning routine, workday/school activities, and evening relaxation.' },
          { id: 'q2', text: 'Describe your favorite hobby.', keywords: ['enjoy', 'practice', 'free time'], timeLimit: 60, modelAnswer: 'Student should mention what the hobby is, why they enjoy it, and how often they practice.' },
        ],
      },
      {
        id: 'model-b',
        name: 'Model B',
        questions: [
          { id: 'q3', text: 'How do you prepare for exams?', keywords: ['study', 'schedule', 'review'], timeLimit: 60, modelAnswer: 'Student should describe their study timetable, revision techniques, and practice tests.' },
        ],
      },
    ],
  },
  {
    id: 'exam-2',
    code: 'SCI-1B9C',
    title: 'Science Quiz - Grade 8 (MCQ)',
    type: 'mcq',
    subject: 'Science',
    description: 'Short quiz on photosynthesis and plant biology with multiple choice questions.',
    status: 'published',
    createdAt: '2026-08-02T09:30:00.000Z',
    studentCount: 14,
    averageScore: 78,
    questions: [
      {
        id: 'q1',
        text: 'What primary pigment absorbs light during photosynthesis?',
        keywords: ['chlorophyll', 'pigment', 'light'],
        timeLimit: 90,
        options: ['Chlorophyll', 'Carotenoid', 'Hemoglobin', 'Anthocyanin'],
        modelAnswer: 'Chlorophyll is the green pigment in plants that absorbs light energy.',
      },
      {
        id: 'q2',
        text: 'Which gas is produced as a byproduct of photosynthesis?',
        keywords: ['oxygen', 'gas', 'byproduct'],
        timeLimit: 60,
        options: ['Oxygen (O2)', 'Carbon Dioxide (CO2)', 'Nitrogen (N2)', 'Methane (CH4)'],
        modelAnswer: 'Oxygen is released into the atmosphere as a byproduct.',
      },
    ],
  },
  {
    id: 'exam-3',
    code: 'HIS-3D4E',
    title: 'History Essay - Causes of WW2',
    type: 'essay',
    subject: 'History',
    description: 'Written essay assessment analyzing key diplomatic and economic factors leading to World War II.',
    status: 'draft',
    createdAt: '2026-08-05T14:00:00.000Z',
    studentCount: 0,
    averageScore: 0,
    questions: [
      {
        id: 'q1',
        text: 'Analyze the impact of the Treaty of Versailles on the outbreak of World War II.',
        keywords: ['treaty', 'economy', 'reparations'],
        timeLimit: 180,
        modelAnswer: 'Essay should discuss war guilt clauses, heavy economic reparations, territorial losses, and political instability in Weimar Germany.',
      },
    ],
  },
  {
    id: 'exam-4',
    code: 'PRS-5V7X',
    title: 'French Oral Presentation',
    type: 'video',
    subject: 'French',
    description: 'Video-recorded oral presentation assessing pronunciation, fluency, and confidence in spoken French.',
    status: 'published',
    createdAt: '2026-08-06T11:00:00.000Z',
    studentCount: 8,
    averageScore: 81,
    questions: [
      {
        id: 'q1',
        text: 'Présentez-vous et décrivez votre routine quotidienne en français.',
        keywords: ['routine', 'quotidienne', 'matin', 'soir'],
        timeLimit: 120,
        modelAnswer: 'Student should introduce themselves and describe daily activities using present tense verbs and time expressions.',
      },
      {
        id: 'q2',
        text: 'Décrivez votre ville natale et ce que vous aimez y faire.',
        keywords: ['ville', 'activités', 'aimer', 'endroit'],
        timeLimit: 120,
        modelAnswer: 'Student should describe their hometown, landmarks, and leisure activities using descriptive adjectives.',
      },
    ],
  },
];

export function getExams(): Exam[] {
  if (typeof window === 'undefined') return seedExams;
  ensureDataVersion();
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
