/**
 * Bot messages in English and Arabic. Follows the teacher's Telegram language_code
 * (Arabic for "ar*", English otherwise). Never names an AI / speech / hosting vendor:
 * say "AI provider" if anything. Pure.
 */

export type Lang = 'en' | 'ar';

export function langFrom(code: unknown): Lang {
  return typeof code === 'string' && code.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export interface FinalInfo {
  title: string;
  questionCount: number;
  secondsPerQuestion: number;
  totalMinutes: number;
  status: 'published' | 'scheduled' | 'draft';
  scheduledLabel: string | null;
  missingAnswers: number;
  examUrl: string;
  examCode: string;
  dashboardUrl: string;
}

export interface SummaryInfo {
  count: number;
  withAnswer: number;
  tooManyOptions: number;
  dropped: number;
}

const en = {
  welcome: (settingsUrl: string) =>
    [
      'Hi! I am Examly, your exam assistant on Telegram.',
      'Send me a PDF of MCQ questions and I will turn it into an exam.',
      '',
      'To start, connect your account:',
      '1. Dashboard > Settings > Telegram Bot > Connect Telegram',
      '2. Send the code here: /start CODE',
      settingsUrl,
    ].join('\n'),
  welcomeLinked: 'Hi again! Your account is connected. Send /newexam to create an exam.',
  notLinked: (settingsUrl: string) =>
    [
      'This chat is not connected to Examly yet.',
      '1. Dashboard > Settings > Telegram Bot > Connect Telegram',
      '2. Send the code here: /start CODE',
      settingsUrl,
    ].join('\n'),
  linked: (name: string | null) =>
    `${name ? `Connected, ${name}!` : 'Connected!'} Send /newexam to create your first exam.`,
  linkBadCode: 'That code is invalid or expired. Get a new one in Dashboard > Settings > Telegram Bot (codes last 10 minutes, one use).',
  linkTooMany: 'Too many attempts. Please wait a few minutes and try again.',
  notPro: (billingUrl: string) => `Pro plan required. Upgrade here: ${billingUrl}`,
  newExam: 'Send me your exam PDF now (MCQ questions, PDF only, up to 10 MB).',
  awaitingPdf: 'I am waiting for your PDF file. Send it here, or /cancel.',
  unlinked: 'This chat is now disconnected from Examly. You can connect again from the dashboard at any time.',
  cancelled: 'Cancelled. Send /newexam whenever you are ready.',
  sendPdf: 'Send /newexam to create an exam, or just send me the PDF. /help for details.',
  groupChat: 'Please use Examly in a private chat.',
  notPdf: 'Please send a PDF file (other file types are not supported).',
  tooLarge: (mb: number) => `This file is too large. The maximum is ${mb} MB.`,
  tooManyPages: (pages: number) => `This PDF has too many pages. The maximum is ${pages} pages; please split it.`,
  dailyLimit: (n: number) => `You have reached today's limit of ${n} PDFs. Please try again tomorrow.`,
  busy: 'I am still reading your previous PDF. Please wait a moment.',
  draftInProgress: 'You already have an exam in progress. Finish it, or send /cancel to start over.',
  reading: 'Reading your PDF...',
  readFailed: 'I could not read questions from this PDF. Please check the file and try again, or create the exam in the dashboard.',
  timeout: 'Reading this PDF took too long. Try a shorter or simpler file.',
  noMcq: 'I did not find any multiple-choice questions in this PDF. This version of the bot supports MCQ exams only.',
  summary: (s: SummaryInfo) => {
    const lines = [`I found ${s.count} multiple-choice question${s.count === 1 ? '' : 's'}.`, `Correct answer detected: ${s.withAnswer} of ${s.count}.`];
    if (s.tooManyOptions > 0) lines.push(`Not imported: ${s.tooManyOptions} with more than 4 options (add them in the dashboard).`);
    if (s.dropped > 0) lines.push(`Skipped: ${s.dropped} item(s) that were not clear MCQs.`);
    lines.push('', 'Does this look right?');
    return lines.join('\n');
  },
  looksGood: 'Looks good',
  cancel: 'Cancel',
  askTitle: 'What is the exam title? (Send it as a message, up to 120 characters.)',
  titleInvalid: 'Please send a title between 1 and 120 characters.',
  askDuration: 'How long should students have?',
  minutes: (n: number) => `${n} min`,
  other: 'Other',
  askMinutes: 'Send the exam time in minutes (1-300).',
  minutesInvalid: 'Please send a whole number of minutes between 1 and 300.',
  missingIntro: (n: number) => `${n} question${n === 1 ? ' has' : 's have'} no detected answer. Please choose the correct option for each.`,
  question: (i: number, total: number, text: string, options: string[]) =>
    [`Question ${i} of ${total}:`, text, '', ...options.map((o, k) => `${'ABCDEF'[k]}) ${o}`)].join('\n'),
  skip: 'Skip (set later in dashboard)',
  allLater: 'Set all remaining later',
  askPublish: (missing: number) =>
    missing > 0
      ? `${missing} question${missing === 1 ? '' : 's'} still need${missing === 1 ? 's' : ''} a correct answer, so the exam will be saved as a DRAFT. Set the answers in the dashboard, then publish there.\n\nPublish or schedule?`
      : 'All answers are set. Publish now or schedule a start time?',
  publishNow: 'Publish now',
  schedule: 'Schedule',
  askSchedule: 'Send the start date and time (Cairo time), for example:\n2026-12-01 18:30\ntomorrow 6pm',
  scheduleUnrecognized: 'I could not understand that time. Try: 2026-12-01 18:30 or tomorrow 6pm',
  schedulePast: 'That time is in the past. Please send a future date and time (Cairo time).',
  scheduleTooFar: 'Please choose a time within the next 12 months.',
  scheduleConfirm: (label: string) => `Start time: ${label} (Cairo time). Is that right?`,
  confirm: 'Confirm',
  change: 'Change',
  creating: 'Creating your exam...',
  createFailed: 'Sorry, the exam could not be created. Nothing was saved. Please try again or use the dashboard.',
  stale: 'This button is no longer active.',
  final: (f: FinalInfo) => {
    const status =
      f.status === 'published'
        ? 'Published: students can join now.'
        : f.status === 'scheduled'
          ? `Scheduled: students can join from ${f.scheduledLabel} (Cairo time).`
          : `Draft: ${f.missingAnswers} question${f.missingAnswers === 1 ? '' : 's'} need${f.missingAnswers === 1 ? 's' : ''} a correct answer. Set ${f.missingAnswers === 1 ? 'it' : 'them'} in the dashboard, then press Publish.${f.scheduledLabel ? ` Planned start: ${f.scheduledLabel} (Cairo time).` : ''}`;
    return [
      `Exam created: ${f.title}`,
      `Questions: ${f.questionCount}`,
      `Time: about ${f.totalMinutes} min (${f.secondsPerQuestion} s per question)`,
      `Status: ${status}`,
      '',
      `Student link: ${f.examUrl}`,
      `Exam code: ${f.examCode}`,
      `Open in dashboard: ${f.dashboardUrl}`,
    ].join('\n');
  },
};

type Messages = typeof en;

const ar: Messages = {
  welcome: (settingsUrl) =>
    [
      'أهلًا! أنا Examly، مساعدك للاختبارات على تيليجرام.',
      'أرسل لي ملف PDF بأسئلة اختيار من متعدد وسأحوّله إلى اختبار.',
      '',
      'للبدء، اربط حسابك:',
      '1. لوحة التحكم > الإعدادات > Telegram Bot > Connect Telegram',
      '2. أرسل الرمز هنا: ‎/start CODE',
      settingsUrl,
    ].join('\n'),
  welcomeLinked: 'أهلًا من جديد! حسابك مربوط. أرسل ‎/newexam لإنشاء اختبار.',
  notLinked: (settingsUrl) =>
    [
      'هذه المحادثة غير مربوطة بـ Examly بعد.',
      '1. لوحة التحكم > الإعدادات > Telegram Bot > Connect Telegram',
      '2. أرسل الرمز هنا: ‎/start CODE',
      settingsUrl,
    ].join('\n'),
  linked: (name) => `${name ? `تم الربط يا ${name}!` : 'تم الربط!'} أرسل ‎/newexam لإنشاء أول اختبار.`,
  linkBadCode: 'هذا الرمز غير صحيح أو انتهت صلاحيته. احصل على رمز جديد من لوحة التحكم > الإعدادات > Telegram Bot (صالح 10 دقائق ولمرة واحدة).',
  linkTooMany: 'محاولات كثيرة. انتظر بضع دقائق ثم حاول مرة أخرى.',
  notPro: (billingUrl) => `يلزم الاشتراك في باقة Pro. للترقية: ${billingUrl}`,
  newExam: 'أرسل لي ملف PDF للاختبار الآن (أسئلة اختيار من متعدد، ملف PDF فقط، حتى 10 ميجابايت).',
  awaitingPdf: 'في انتظار ملف PDF. أرسله هنا، أو ‎/cancel.',
  unlinked: 'تم فصل هذه المحادثة عن Examly. يمكنك الربط مرة أخرى من لوحة التحكم في أي وقت.',
  cancelled: 'تم الإلغاء. أرسل ‎/newexam عندما تكون جاهزًا.',
  sendPdf: 'أرسل ‎/newexam لإنشاء اختبار، أو أرسل ملف PDF مباشرة. ‎/help للمساعدة.',
  groupChat: 'يُرجى استخدام Examly في محادثة خاصة.',
  notPdf: 'يُرجى إرسال ملف PDF (أنواع الملفات الأخرى غير مدعومة).',
  tooLarge: (mb) => `الملف كبير جدًا. الحد الأقصى ${mb} ميجابايت.`,
  tooManyPages: (pages) => `عدد صفحات الملف كبير جدًا. الحد الأقصى ${pages} صفحة؛ يُرجى تقسيمه.`,
  dailyLimit: (n) => `وصلت إلى الحد اليومي (${n} ملفات). حاول مرة أخرى غدًا.`,
  busy: 'ما زلت أقرأ الملف السابق. انتظر لحظة من فضلك.',
  draftInProgress: 'لديك اختبار قيد الإنشاء. أكمله أو أرسل ‎/cancel للبدء من جديد.',
  reading: 'جارٍ قراءة ملف PDF...',
  readFailed: 'لم أتمكن من قراءة الأسئلة من هذا الملف. تحقّق من الملف وحاول مرة أخرى، أو أنشئ الاختبار من لوحة التحكم.',
  timeout: 'استغرقت قراءة الملف وقتًا طويلًا. جرّب ملفًا أقصر أو أبسط.',
  noMcq: 'لم أجد أسئلة اختيار من متعدد في هذا الملف. هذا الإصدار من البوت يدعم اختبارات الاختيار من متعدد فقط.',
  summary: (s) => {
    const lines = [`وجدت ${s.count} سؤال اختيار من متعدد.`, `الإجابة الصحيحة محددة في ${s.withAnswer} من ${s.count}.`];
    if (s.tooManyOptions > 0) lines.push(`لم يتم استيراد ${s.tooManyOptions} سؤال لأن فيها أكثر من 4 اختيارات (أضفها من لوحة التحكم).`);
    if (s.dropped > 0) lines.push(`تم تخطي ${s.dropped} عنصر غير واضح.`);
    lines.push('', 'هل هذا صحيح؟');
    return lines.join('\n');
  },
  looksGood: 'تمام',
  cancel: 'إلغاء',
  askTitle: 'ما عنوان الاختبار؟ (أرسله في رسالة، حتى 120 حرفًا.)',
  titleInvalid: 'يُرجى إرسال عنوان من 1 إلى 120 حرفًا.',
  askDuration: 'كم من الوقت يحتاج الطلاب؟',
  minutes: (n) => `${n} دقيقة`,
  other: 'مدة أخرى',
  askMinutes: 'أرسل مدة الاختبار بالدقائق (من 1 إلى 300).',
  minutesInvalid: 'يُرجى إرسال عدد صحيح من الدقائق بين 1 و300.',
  missingIntro: (n) => `${n} سؤال بدون إجابة محددة. اختر الإجابة الصحيحة لكل سؤال.`,
  question: (i, total, text, options) =>
    [`السؤال ${i} من ${total}:`, text, '', ...options.map((o, k) => `${'ABCDEF'[k]}) ${o}`)].join('\n'),
  skip: 'تخطي (لاحقًا من لوحة التحكم)',
  allLater: 'تحديد الباقي لاحقًا',
  askPublish: (missing) =>
    missing > 0
      ? `${missing} سؤال ما زال بدون إجابة صحيحة، لذلك سيُحفظ الاختبار كمسودة. حدّد الإجابات من لوحة التحكم ثم انشره من هناك.\n\nنشر أم جدولة؟`
      : 'كل الإجابات محددة. هل تريد النشر الآن أم تحديد موعد للبدء؟',
  publishNow: 'انشر الآن',
  schedule: 'جدولة',
  askSchedule: 'أرسل تاريخ ووقت البدء (بتوقيت القاهرة)، مثلًا:\n2026-12-01 18:30\nغدا 6 مساء',
  scheduleUnrecognized: 'لم أفهم هذا الوقت. جرّب: 2026-12-01 18:30 أو غدا 6 مساء',
  schedulePast: 'هذا الوقت في الماضي. أرسل تاريخًا ووقتًا في المستقبل (بتوقيت القاهرة).',
  scheduleTooFar: 'يُرجى اختيار موعد خلال الاثني عشر شهرًا القادمة.',
  scheduleConfirm: (label) => `موعد البدء: ${label} (بتوقيت القاهرة). هل هذا صحيح؟`,
  confirm: 'تأكيد',
  change: 'تغيير',
  creating: 'جارٍ إنشاء الاختبار...',
  createFailed: 'عذرًا، تعذّر إنشاء الاختبار ولم يُحفظ شيء. حاول مرة أخرى أو استخدم لوحة التحكم.',
  stale: 'هذا الزر لم يعد فعّالًا.',
  final: (f) => {
    const status =
      f.status === 'published'
        ? 'منشور: يمكن للطلاب الدخول الآن.'
        : f.status === 'scheduled'
          ? `مجدول: يمكن للطلاب الدخول بدءًا من ${f.scheduledLabel} (بتوقيت القاهرة).`
          : `مسودة: ${f.missingAnswers} سؤال يحتاج إلى إجابة صحيحة. حدّدها من لوحة التحكم ثم اضغط نشر.${f.scheduledLabel ? ` موعد البدء المخطط: ${f.scheduledLabel} (بتوقيت القاهرة).` : ''}`;
    return [
      `تم إنشاء الاختبار: ${f.title}`,
      `عدد الأسئلة: ${f.questionCount}`,
      `المدة: حوالي ${f.totalMinutes} دقيقة (${f.secondsPerQuestion} ثانية لكل سؤال)`,
      `الحالة: ${status}`,
      '',
      `رابط الطلاب: ${f.examUrl}`,
      `رمز الاختبار: ${f.examCode}`,
      `فتح في لوحة التحكم: ${f.dashboardUrl}`,
    ].join('\n');
  },
};

/** /help: always bilingual (English, then Arabic). */
export function helpText(limits: { maxPdfBytes: number; maxPdfPages: number }): string {
  const mb = Math.round(limits.maxPdfBytes / (1024 * 1024));
  return [
    'Examly: create an MCQ exam from a PDF',
    '1. Link: Dashboard > Settings > Telegram Bot > Connect Telegram, then /start CODE',
    '2. Send /newexam, then your PDF',
    '3. Set the exam time',
    '4. Confirm the correct answers',
    '5. Publish now or schedule',
    `Limits: PDF only, up to ${mb} MB (about ${limits.maxPdfPages} pages). MCQ with up to 4 options. The exam time is split evenly across the questions.`,
    'Commands: /newexam /start /help /cancel /unlink',
    '',
    'Examly: إنشاء اختبار اختيار من متعدد من ملف PDF',
    '1. الربط: لوحة التحكم > الإعدادات > Telegram Bot > Connect Telegram، ثم ‎/start CODE',
    '2. أرسل ‎/newexam ثم ملف PDF',
    '3. حدّد مدة الاختبار',
    '4. أكّد الإجابات الصحيحة',
    '5. انشر الآن أو حدّد موعدًا',
    `الحدود: ملفات PDF فقط، حتى ${mb} ميجابايت (حوالي ${limits.maxPdfPages} صفحة). اختيار من متعدد حتى 4 اختيارات. تُقسَّم مدة الاختبار بالتساوي على الأسئلة.`,
    'الأوامر: ‎/newexam ‎/start ‎/help ‎/cancel ‎/unlink',
  ].join('\n');
}

export function t(lang: Lang): Messages {
  return lang === 'ar' ? ar : en;
}
