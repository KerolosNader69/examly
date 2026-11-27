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
  help: (dashboardUrl: string) =>
    [
      'Examly bot: create an MCQ exam from a PDF.',
      '',
      '1. Send me a PDF with multiple-choice questions (max 10 MB, about 30 pages).',
      '2. Check the summary, choose the exam time and fill in any missing answers.',
      '3. Publish now or schedule a start time.',
      '',
      'Commands: /help, /cancel (start over), /unlink (disconnect this chat).',
      `Your exams: ${dashboardUrl}`,
    ].join('\n'),
  notLinked: (settingsUrl: string) =>
    [
      'This chat is not connected to an Examly account yet.',
      `1. Open ${settingsUrl} (Pro plan).`,
      '2. Press "Connect Telegram" to get a one-time code.',
      '3. Send it here as: /start YOUR-CODE',
    ].join('\n'),
  linked: (name: string | null) =>
    `${name ? `Connected to ${name}'s Examly account.` : 'Connected to your Examly account.'} Send me a PDF of MCQ questions to create an exam. /help for details.`,
  linkBadCode: 'That code is invalid or expired. Get a new one from the dashboard (codes expire after 10 minutes and work once).',
  linkTooMany: 'Too many attempts. Please wait a few minutes and try again.',
  notPro: (billingUrl: string) => `Creating exams from Telegram is part of the Pro plan. Upgrade here: ${billingUrl}`,
  unlinked: 'This chat is now disconnected from Examly. You can connect again from the dashboard at any time.',
  cancelled: 'Cancelled. Send a new PDF whenever you are ready.',
  sendPdf: 'Send me a PDF with multiple-choice questions to create an exam. /help for details.',
  groupChat: 'Please use the Examly bot in a private chat.',
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
  help: (dashboardUrl) =>
    [
      'بوت Examly: أنشئ اختبار اختيار من متعدد من ملف PDF.',
      '',
      '1. أرسل لي ملف PDF فيه أسئلة اختيار من متعدد (حتى 10 ميجابايت، حوالي 30 صفحة).',
      '2. راجع الملخص، واختر مدة الاختبار، وحدّد الإجابات الناقصة.',
      '3. انشر الآن أو حدّد موعدًا للبدء.',
      '',
      'الأوامر: /help، ‏/cancel (البدء من جديد)، ‏/unlink (فصل هذه المحادثة).',
      `اختباراتك: ${dashboardUrl}`,
    ].join('\n'),
  notLinked: (settingsUrl) =>
    [
      'هذه المحادثة غير مرتبطة بحساب Examly بعد.',
      `1. افتح ${settingsUrl} (باقة Pro).`,
      '2. اضغط "ربط تيليجرام" للحصول على رمز يُستخدم مرة واحدة.',
      '3. أرسله هنا بهذا الشكل: ‎/start الرمز',
    ].join('\n'),
  linked: (name) =>
    `${name ? `تم الربط بحساب Examly الخاص بـ ${name}.` : 'تم الربط بحسابك على Examly.'} أرسل ملف PDF بأسئلة اختيار من متعدد لإنشاء اختبار. ‏/help للمساعدة.`,
  linkBadCode: 'هذا الرمز غير صحيح أو انتهت صلاحيته. احصل على رمز جديد من لوحة التحكم (الرمز صالح 10 دقائق ولمرة واحدة).',
  linkTooMany: 'محاولات كثيرة. انتظر بضع دقائق ثم حاول مرة أخرى.',
  notPro: (billingUrl) => `إنشاء الاختبارات من تيليجرام متاح في باقة Pro. يمكنك الترقية من هنا: ${billingUrl}`,
  unlinked: 'تم فصل هذه المحادثة عن Examly. يمكنك الربط مرة أخرى من لوحة التحكم في أي وقت.',
  cancelled: 'تم الإلغاء. أرسل ملف PDF جديدًا عندما تكون جاهزًا.',
  sendPdf: 'أرسل لي ملف PDF فيه أسئلة اختيار من متعدد لإنشاء اختبار. ‏/help للمساعدة.',
  groupChat: 'يُرجى استخدام بوت Examly في محادثة خاصة.',
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

export function t(lang: Lang): Messages {
  return lang === 'ar' ? ar : en;
}
