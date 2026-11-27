import React from 'react';
import LegalLayout from '@/components/layout/LegalLayout';
import type { Metadata } from 'next';
import { RECORDING_RETENTION_DAYS } from '@/lib/consent';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Examly collects during an exam, who processes it, and how long it is kept.',
  alternates: {
    canonical: '/privacy',
  },
};

// TODO(privacy-contact): replace PLACEHOLDER_EMAIL with the real privacy contact address before launch.
const PRIVACY_CONTACT_EMAIL = 'PLACEHOLDER_EMAIL';

/**
 * Every statement here must match what the code does (see lib/consent.ts,
 * app/api/cron/recording-retention, app/api/teacher/recording-*, lib/reviewReason.ts).
 * Deliberately NOT claimed: that Google does not use the data for training (depends on
 * the Gemini API billing tier, which the code cannot guarantee), and that teachers can
 * delete a whole exam in the app (there is no such feature yet).
 */
export default function PrivacyPage() {
  const days = RECORDING_RETENTION_DAYS;
  return (
    <LegalLayout title="Privacy Policy / سياسة الخصوصية" updated="November 27, 2026">
      <p className="text-center">
        <a href="#en">English</a> · <a href="#ar" lang="ar">العربية</a>
      </p>

      <div id="en" lang="en" className="space-y-8">
        <h2>What we collect during an exam</h2>
        <ul>
          <li>The name and student code you type when you join an exam.</li>
          <li>For oral exams: a recording of your voice for each answer (and camera video for video exams).</li>
          <li>The text transcript of each spoken answer, your typed answers (MCQ choices, essays), and the scores and feedback.</li>
          <li>The time you agreed to the recording notice, and how often you left the exam tab.</li>
        </ul>

        <h2>Why</h2>
        <p>To grade the exam and to let your teacher review your answers and the AI suggestions.</p>

        <h2>Who processes it</h2>
        <ul>
          <li><strong>Deepgram</strong> converts the audio of your answers to text.</li>
          <li>
            <strong>Google Gemini</strong> receives the transcript (not the recording) together with the question and suggests a
            score. When a teacher generates class insights, Gemini also receives the students&apos; names, scores and transcripts for that exam.
          </li>
          <li><strong>Supabase</strong> stores the data and the recordings.</li>
          <li><strong>Vercel</strong> hosts the website and runs the server code.</li>
        </ul>
        <p>
          These providers process the data under their own terms. Depending on the Google API plan used, Google may use data sent to
          Gemini to improve its products; avoid saying personal details in your answers that are not needed for the exam.
        </p>

        <h2>How long we keep it</h2>
        <ul>
          <li>Recordings (audio and video) are deleted automatically {days} days after the exam.</li>
          <li>
            Transcripts, typed answers and scores are kept so your teacher can review them, until deletion is requested (see
            “Your rights” below). Teachers cannot yet delete a whole exam themselves in the app.
          </li>
          <li>A teacher can delete a student&apos;s recording earlier at any time.</li>
        </ul>

        <h2>Who can see it</h2>
        <p>
          In the app, only the teacher who created the exam. Recordings are stored in private storage and can only be played through
          links that expire after 60 minutes, created after checking that the request comes from that teacher. Examly&apos;s operators
          can technically access the database to run and fix the service.
        </p>

        <h2>AI is advisory</h2>
        <p>
          AI scores are suggestions. Your teacher sees every answer and can change any score. Answers the AI could not grade go to your
          teacher for review. By default, answers with unclear audio or that seem to be in a different language than the exam&apos;s also
          go to your teacher instead of being scored automatically (a teacher can choose a different rule for an exam: score such answers
          0, or grade them anyway).
        </p>

        <h2>Known limitations</h2>
        <p>
          Speech recognition and AI grading are not perfect. Accuracy can be lower with strong accents, background noise, a poor
          microphone, or mixed languages. This is why your teacher reviews unclear cases.
        </p>

        <h2>Your rights and contact</h2>
        <p>
          You can ask for a copy of your data, a correction, or deletion. Contact your teacher or school, or write to us at{' '}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
        </p>
      </div>

      <div id="ar" lang="ar" dir="rtl" className="space-y-8 border-t border-gray-200 dark:border-light-mint/15 pt-8 text-right">
        <h2>ما الذي نجمعه أثناء الاختبار</h2>
        <ul className="!pl-0 pr-6">
          <li>الاسم ورمز الطالب اللذان تكتبهما عند دخول الاختبار.</li>
          <li>في الاختبارات الشفهية: تسجيل لصوتك في كل إجابة (وفيديو الكاميرا في اختبارات الفيديو).</li>
          <li>النص المكتوب لكل إجابة منطوقة، وإجاباتك المكتوبة (اختيارات الأسئلة متعددة الخيارات والمقالات)، والدرجات والملاحظات.</li>
          <li>وقت موافقتك على إشعار التسجيل، وعدد مرات مغادرتك لصفحة الاختبار.</li>
        </ul>

        <h2>لماذا</h2>
        <p>لتصحيح الاختبار، وليتمكّن معلّمك من مراجعة إجاباتك واقتراحات الذكاء الاصطناعي.</p>

        <h2>من يعالج البيانات</h2>
        <ul className="!pl-0 pr-6">
          <li><strong>Deepgram</strong>: تحويل صوت إجاباتك إلى نص.</li>
          <li>
            <strong>Google Gemini</strong>: يستلم النص المكتوب (وليس التسجيل) مع السؤال ويقترح درجة. وعندما يطلب المعلّم ملخّص أداء الصف،
            يستلم Gemini أيضًا أسماء الطلاب ودرجاتهم ونصوص إجاباتهم في ذلك الاختبار.
          </li>
          <li><strong>Supabase</strong>: تخزين البيانات والتسجيلات.</li>
          <li><strong>Vercel</strong>: استضافة الموقع وتشغيل الخادم.</li>
        </ul>
        <p>
          يعالج هؤلاء المزوّدون البيانات وفق شروطهم. وبحسب خطة Google المستخدمة، قد تستخدم Google البيانات المرسلة إلى Gemini لتحسين
          منتجاتها؛ لذا تجنّب ذكر معلومات شخصية في إجاباتك لا يحتاجها الاختبار.
        </p>

        <h2>مدة الحفظ</h2>
        <ul className="!pl-0 pr-6">
          <li>تُحذف التسجيلات (الصوت والفيديو) تلقائيًا بعد {days} يومًا من الاختبار.</li>
          <li>
            تُحفظ النصوص والإجابات المكتوبة والدرجات ليراجعها معلّمك إلى أن يُطلب حذفها (انظر «حقوقك» أدناه). لا يستطيع المعلّم حاليًا
            حذف اختبار كامل بنفسه من داخل التطبيق.
          </li>
          <li>يمكن للمعلّم حذف تسجيل أي طالب في أي وقت قبل ذلك.</li>
        </ul>

        <h2>من يمكنه الاطّلاع عليها</h2>
        <p>
          داخل التطبيق، المعلّم الذي أنشأ الاختبار فقط. تُخزَّن التسجيلات في مساحة تخزين خاصة، ولا يمكن تشغيلها إلا عبر روابط تنتهي
          صلاحيتها بعد 60 دقيقة، تُنشأ بعد التحقق من أن الطلب صادر عن ذلك المعلّم. ويستطيع مشغّلو Examly تقنيًا الوصول إلى قاعدة البيانات
          لتشغيل الخدمة وإصلاحها.
        </p>

        <h2>الذكاء الاصطناعي استرشادي</h2>
        <p>
          الدرجات التي يقترحها الذكاء الاصطناعي اقتراحات فقط. يرى معلّمك كل إجابة ويمكنه تعديل أي درجة. الإجابات التي تعذّر على الذكاء
          الاصطناعي تصحيحها تُحال إلى معلّمك للمراجعة. وافتراضيًا، تُحال إليه أيضًا الإجابات ذات الصوت غير الواضح أو التي تبدو بلغة غير
          لغة الاختبار بدلًا من تصحيحها تلقائيًا (ويمكن للمعلّم اختيار قاعدة أخرى للاختبار: منحها صفرًا أو تصحيحها رغم ذلك).
        </p>

        <h2>قيود معروفة</h2>
        <p>
          التعرّف على الكلام والتصحيح الآلي ليسا مثاليين، وقد تقلّ الدقة مع اللهجات القوية أو الضوضاء أو ضعف الميكروفون أو خلط اللغات.
          ولهذا يراجع معلّمك الحالات غير الواضحة.
        </p>

        <h2>حقوقك والتواصل</h2>
        <p>
          يمكنك طلب نسخة من بياناتك أو تصحيحها أو حذفها. تواصل مع معلّمك أو مدرستك، أو راسلنا على{' '}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} dir="ltr">{PRIVACY_CONTACT_EMAIL}</a>.
        </p>
      </div>
    </LegalLayout>
  );
}
