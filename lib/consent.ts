/**
 * Recording consent shown in the student join flow, and the retention period it
 * promises. Pure and client-safe (used by JoinStage, /api/exam/join, /upload-url,
 * /transcribe, the retention cron and /privacy). Tests: tests/unit/privacy.test.ts.
 *
 * Changing ANY wording below that changes what the student agrees to, or the retention
 * period, needs a new CONSENT_VERSION (stored per submission in consent_version).
 */

export const CONSENT_VERSION = '2026-11-v1';

/** Recording files (audio/video) are deleted this many days after the exam started. */
export const RECORDING_RETENTION_DAYS = 90;

const RECORDING_TYPES = new Set(['audio', 'video', 'audio_video']);

/** Exam types that record the student. Missing type = 'audio' (same default as the rest of the app). */
export function examRecords(examType: unknown): boolean {
  return RECORDING_TYPES.has(typeof examType === 'string' && examType ? examType : 'audio');
}

export function examRecordsVideo(examType: unknown): boolean {
  return examType === 'video' || examType === 'audio_video';
}

/** Valid consent from a request body ({ accepted: true, version: CONSENT_VERSION }), else null. */
export function parseConsent(value: unknown): { version: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as { accepted?: unknown; version?: unknown };
  return v.accepted === true && v.version === CONSENT_VERSION ? { version: CONSENT_VERSION } : null;
}

export type NoticeLang = 'en' | 'ar';

/** Notice language that matches the exam language (Arabic exams -> Arabic). */
export function noticeLangForExam(examLanguage: unknown): NoticeLang {
  return typeof examLanguage === 'string' && examLanguage.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export interface ConsentNoticeText {
  title: string;
  items: { label: string; text: string }[];
  checkbox: string;
  required: string;
  privacyLink: string;
  /** Link text for exams that do not record (MCQ / essay). */
  privacyLinkNoRecording: string;
  switchTo: string;
}

/**
 * Notice text. Everything here must match what the code does:
 *  - transcription gets an audio-only copy (lib/mediaCapture.ts), Gemini gets the transcript text;
 *  - recordings are deleted RECORDING_RETENTION_DAYS after the exam (app/api/cron/recording-retention);
 *  - the teacher can override any AI score (dashboard Results page).
 */
export function consentNotice(lang: NoticeLang, { video }: { video: boolean }): ConsentNoticeText {
  const days = RECORDING_RETENTION_DAYS;
  if (lang === 'ar') {
    return {
      title: 'قبل أن تبدأ: هذا الاختبار مسجَّل',
      items: [
        {
          label: 'ما الذي يُسجَّل',
          text: video ? 'صوتك وصورة الكاميرا (فيديو) أثناء إجابتك عن كل سؤال.' : 'صوتك أثناء إجابتك عن كل سؤال.',
        },
        {
          label: 'من يطّلع عليه',
          text:
            'معلّم هذا الاختبار فقط. ويُرسَل صوت إجابتك إلى مزوّد خدمة تحويل الكلام إلى نص، ثم يُرسَل النص إلى مزوّد خدمة التصحيح بالذكاء الاصطناعي ليقترح درجة. الدرجة المقترحة استرشادية، ويمكن لمعلّمك تعديلها.',
        },
        {
          label: 'مدة الحفظ',
          text: `تُحذف التسجيلات تلقائيًا بعد ${days} يومًا من الاختبار. أما النص المكتوب والدرجات فتبقى ليراجعها معلّمك إلى أن يُطلب حذفها.`,
        },
      ],
      checkbox: 'أفهم ذلك وأوافق',
      required: 'يُرجى تحديد خانة «أفهم ذلك وأوافق» قبل بدء الاختبار.',
      privacyLink: 'تفاصيل الخصوصية',
      privacyLinkNoRecording: 'كيف نتعامل مع بياناتك',
      switchTo: 'English',
    };
  }
  return {
    title: 'Before you start: this exam is recorded',
    items: [
      {
        label: 'What is recorded',
        text: video ? 'Your voice and camera video while you answer each question.' : 'Your voice while you answer each question.',
      },
      {
        label: 'Who sees it',
        text:
          'Only the teacher of this exam. The audio of your answer is sent to a speech-to-text provider to turn speech into text, and the text is sent to an AI grading provider, which suggests a score. The AI score is advisory: your teacher can change it.',
      },
      {
        label: 'How long it is kept',
        text: `Recordings are deleted automatically ${days} days after the exam. The transcript and scores stay available to your teacher until deletion is requested.`,
      },
    ],
    checkbox: 'I understand and agree',
    required: 'Please tick “I understand and agree” before you start the exam.',
    privacyLink: 'Privacy details',
    privacyLinkNoRecording: 'How we handle your data',
    switchTo: 'العربية',
  };
}

/** Error returned by /upload-url and /transcribe for a session without recorded consent. */
export const RECORDING_CONSENT_REQUIRED = 'Recording consent is missing for this exam session. Go back to the exam link and tick “I understand and agree”.';
