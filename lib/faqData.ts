/**
 * FAQ content shared by the server page (app/faq/page.tsx, for JSON-LD)
 * and the client FAQ hub (components/faq/FaqHubContent.tsx).
 * Must stay a plain module (no 'use client') so server code receives the real array.
 */

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export const allFaqs: FaqItem[] = [
  // General
  {
    id: 'what-is-examly',
    category: 'General',
    question: 'What is Examly?',
    answer: 'Examly is an AI-assisted oral examination platform designed for educators and universities. It enables browser-based voice recording, automated transcription by a speech-to-text provider, preliminary evaluation by an AI grading provider, and complete teacher score override controls.',
  },
  {
    id: 'what-is-ai-oral-exam',
    category: 'AI Oral Exams',
    question: 'What is an AI oral exam?',
    answer: 'An AI oral exam allows students to respond to assessment questions by speaking into their device microphone. Spoken responses are transcribed into text and evaluated against teacher-provided reference answers across conceptual understanding, fluency, vocabulary, and grammar.',
  },
  {
    id: 'what-is-viva-voce-exam',
    category: 'AI Oral Exams',
    question: 'What is a viva voce exam?',
    answer: 'A viva voce is an academic oral examination where students verbally defend their knowledge, explain technical concepts, or answer faculty questions to demonstrate subject mastery.',
  },
  {
    id: 'how-evaluates-answers',
    category: 'AI Grading',
    question: 'How does Examly evaluate student spoken answers?',
    answer: 'Audio recordings submitted by students are transcribed into text by a speech-to-text provider. An AI grading provider compares the transcript against the teacher model answer to generate individual criterion scores and an overall score.',
  },
  {
    id: 'what-does-examly-evaluate',
    category: 'AI Grading',
    question: 'What does Examly evaluate?',
    answer: 'Examly evaluates four specific dimensions: Content/Conceptual Correctness, Fluency & Delivery Continuity, Technical Vocabulary Usage, and Grammar & Spoken Syntax.',
  },
  {
    id: 'does-examly-replace-teachers',
    category: 'Teachers',
    question: 'Does Examly replace teachers?',
    answer: 'No. Examly is explicitly designed as a teacher assistance tool. Preliminary AI scores and transcripts are provided to reduce grading workload, but teachers retain 100% control to review recordings and override scores.',
  },
  {
    id: 'can-teachers-override-scores',
    category: 'Teachers',
    question: 'Can teachers override AI-generated scores?',
    answer: 'Yes. In the teacher dashboard, educators can listen to raw audio recordings, inspect speech-to-text transcripts, and enter custom score overrides directly in the student session view.',
  },
  {
    id: 'do-students-need-account',
    category: 'Student Experience',
    question: 'Do students need an account?',
    answer: 'No. Students do not need to register or create accounts. They join an active exam session directly via a 6-digit access code or direct URL provided by their teacher.',
  },
  {
    id: 'how-students-join-exam',
    category: 'Student Experience',
    question: 'How do students join an Examly exam?',
    answer: 'Students navigate to /exam/[code], enter their full name and student roll code, test their microphone input in the preparation stage, and begin recording answers to timed questions.',
  },
  {
    id: 'how-transcribes-responses',
    category: 'AI Evaluation & Speech Pipeline',
    question: 'How does Examly transcribe spoken responses?',
    answer: 'Examly uses a speech-to-text provider to convert student audio recordings into formatted, punctuated text transcripts.',
  },
  {
    id: 'how-supports-exam-integrity',
    category: 'Exam Integrity',
    question: 'How does Examly support exam integrity?',
    answer: 'Examly logs browser window focus changes and tab switches (stored in tab_switch_count) and supports multi-model question variants (Model A, Model B) randomly assigned at student join stage.',
  },
  {
    id: 'does-use-webcam-monitoring',
    category: 'Exam Integrity',
    question: 'Does Examly use webcam monitoring?',
    answer: 'No. Examly does NOT implement webcam proctoring, gaze tracking, or facial recognition models.',
  },
  {
    id: 'does-use-pronunciation-scoring',
    category: 'AI Grading',
    question: 'Does Examly use pronunciation scoring?',
    answer: 'No. Examly evaluates transcribed spoken text for conceptual understanding, fluency, vocabulary, and grammar. Acoustic phoneme pronunciation scoring is not implemented.',
  },
  {
    id: 'how-teachers-generate-pdf-questions',
    category: 'Teachers',
    question: 'How can teachers generate questions from PDFs?',
    answer: 'In the exam creation modal, teachers can upload course syllabus or textbook PDFs. An AI grading provider parses document text to auto-extract structured question sets and reference answers.',
  },
  {
    id: 'can-create-question-variants',
    category: 'Teachers',
    question: 'Can Examly create different question variants?',
    answer: 'Yes. Teachers can configure multiple question variants (Model A, Model B) within a single exam to distribute distinct question sets across student cohorts.',
  },
  {
    id: 'what-reports-can-export',
    category: 'Teachers',
    question: 'What reports can teachers export?',
    answer: 'Teachers can export student roster results as CSV files, generate printable PDF grade reports, and synthesize cohort-wide class AI insights.',
  },
  {
    id: 'can-universities-use-custom-branding',
    category: 'Universities',
    question: 'Can universities use custom branding?',
    answer: 'Yes. Examly supports custom subdomains (e.g. department.examly.site) along with custom institution logos and primary brand color themes stored in teacher settings.',
  },
  {
    id: 'what-ai-models-used',
    category: 'AI Evaluation & Speech Pipeline',
    question: 'What AI models/services does Examly use?',
    answer: 'Examly integrates a speech-to-text provider for transcription, an AI grading provider for response evaluation & PDF parsing, a database and storage provider for authentication & database storage, and an email provider for email notifications.',
  },
];
