import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ScrollReveal from '@/components/ui/ScrollReveal';
import Button from '@/components/ui/Button';
import { getBreadcrumbSchema, getOrganizationSchema, getFAQPageSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'AI-Powered Oral Exams | Examly',
  description: 'Conduct browser-based oral assessments with automatic transcription, AI-assisted evaluation, and complete teacher score override controls.',
  alternates: {
    canonical: '/ai-oral-exams',
  },
  openGraph: {
    title: 'AI-Powered Oral Exams | Examly',
    description: 'Conduct browser-based oral assessments with automatic transcription, AI-assisted evaluation, and complete teacher score override controls.',
    url: 'https://examly.site/ai-oral-exams',
    siteName: 'Examly',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Examly AI Oral Exams' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI-Powered Oral Exams | Examly',
    description: 'Conduct browser-based oral assessments with automatic transcription, AI-assisted evaluation, and complete teacher score override controls.',
    images: ['/og-image.png'],
  },
};

const previewFaqs = [
  {
    question: 'What is an AI oral exam?',
    answer: 'An AI oral exam allows students to record spoken responses in their browser. Deepgram Nova-3 transcribes the audio, and Google Gemini 2.5 Flash provides preliminary scoring against teacher-provided reference answers.',
  },
  {
    question: 'Does Examly replace teacher grading?',
    answer: 'No. Examly provides preliminary scoring and transcription assistance. Teachers retain full control, can listen to student audio recordings, read transcripts, and override any AI-generated score.',
  },
  {
    question: 'Do students need to create an account to take an exam?',
    answer: 'No. Students join exams directly via a 6-digit access code or direct link without creating an account.',
  },
];

export default function AiOralExamsPage() {
  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Home', item: '/' },
    { name: 'AI Oral Exams', item: '/ai-oral-exams' },
  ]);
  const faqSchema = getFAQPageSchema(previewFaqs);
  const orgSchema = getOrganizationSchema();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />

      <Header />

      <main>
        {/* HERO SECTION */}
        <section className="bg-deep-teal relative overflow-hidden py-20 lg:py-28 text-white">
          <div className="absolute inset-0 hero-pattern opacity-30"></div>
          <div className="absolute -top-32 right-0 w-96 h-96 bg-primary-teal/20 rounded-full blur-3xl"></div>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center max-w-4xl">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary-teal/20 border border-primary-teal/40 text-light-mint text-sm font-semibold mb-6">
              Browser-Based Voice Assessment Engine
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-poppins mb-6 leading-tight">
              AI-Powered <span className="gradient-text">Oral Exams</span> for Modern Educators
            </h1>
            <p className="text-lg sm:text-xl text-light-mint/90 max-w-2xl mx-auto mb-8 leading-relaxed">
              Examly helps teachers conduct oral assessments through browser voice recording, Deepgram Nova-3 speech transcription, Google Gemini 2.5 Flash evaluation, and 100% human teacher score control.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button variant="primary" className="w-full sm:w-auto text-base px-8 py-4">
                  Get Started Free
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline" className="w-full sm:w-auto text-base text-white border-light-mint/40 hover:bg-light-mint/10 px-8 py-4">
                  See How It Works
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 1: WHAT IS AN AI ORAL EXAM? */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mb-4">
                  What Is an AI Oral Exam?
                </h2>
                <p className="text-lg text-text-dark/70 dark:text-light-mint/70 leading-relaxed">
                  An AI oral exam evaluates spoken responses using advanced speech-to-text and language modeling, while preserving full human academic oversight.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <ScrollReveal>
                <div className="space-y-4 text-text-dark/80 dark:text-light-mint/80">
                  <p className="leading-relaxed">
                    Traditional oral viva assessments are among the most effective methods for measuring deep conceptual understanding. However, scheduling 1-on-1 sessions for large classes creates severe time bottlenecks.
                  </p>
                  <p className="leading-relaxed">
                    Examly bridges this gap by allowing students to record oral answers directly in their web browser. Deepgram Nova-3 speech-to-text converts spoken responses into text, which Google Gemini 2.5 Flash evaluates against reference rubrics provided by the educator.
                  </p>
                  <div className="p-4 rounded-card bg-primary-teal/10 border border-primary-teal/20 text-deep-teal dark:text-light-mint font-medium text-sm">
                    <strong>Human-in-the-Loop Philosophy:</strong> AI provides preliminary scores and transcripts. Teachers review audio playback, read transcripts, and retain 100% score override authority.
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal>
                <div className="bg-bg-light dark:bg-deep-teal/40 rounded-card-lg border border-primary-teal/20 p-6 space-y-4">
                  <h3 className="text-xl font-bold text-deep-teal dark:text-white font-poppins border-b border-primary-teal/20 pb-3">
                    Core Platform Flow
                  </h3>
                  <ul className="space-y-3 text-sm text-text-dark/80 dark:text-light-mint/80">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary-teal text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                      <span><strong>Browser Voice Recording:</strong> Students record answers using their microphone without downloading external apps.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary-teal text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                      <span><strong>Deepgram Nova-3 Transcription:</strong> Audio is converted into accurate text formatted with proper punctuation.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary-teal text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                      <span><strong>Gemini 2.5 Flash Evaluation:</strong> Spoken content is evaluated against the teacher model answer across 4 key dimensions.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary-teal text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</span>
                      <span><strong>Teacher Score Override:</strong> Teachers review audio recordings, transcripts, and AI feedback to approve or edit scores.</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* SECTION 2: HOW EXAMLY WORKS (WORKFLOW) */}
        <section id="how-it-works" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-7xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-16">
                <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">End-to-End Workflow</span>
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mt-2">
                  How Examly Conducts Oral Assessments
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: '01',
                  title: 'Exam Creation & PDF Import',
                  desc: 'Teachers input exam questions manually or upload syllabus PDFs to auto-extract structured question sets with reference answers.',
                },
                {
                  step: '02',
                  title: 'No-Login Student Access',
                  desc: 'Students join via a 6-digit access code or direct URL, test hardware audio input, and answer timed voice questions.',
                },
                {
                  step: '03',
                  title: 'AI Pipeline & Teacher Override',
                  desc: 'Responses are transcribed via Deepgram and evaluated by Gemini. Teachers review audio playback, transcripts, and final scores.',
                },
              ].map((item, idx) => (
                <ScrollReveal key={idx}>
                  <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/15 p-8 h-full relative">
                    <span className="text-4xl font-extrabold font-poppins text-primary-teal/30 mb-4 block">
                      {item.step}
                    </span>
                    <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white mb-3">
                      {item.title}
                    </h3>
                    <p className="text-text-dark/70 dark:text-light-mint/70 text-sm leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: STUDENT EXPERIENCE */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mb-4">
                  Frictionless Student Experience
                </h2>
                <p className="text-text-dark/70 dark:text-light-mint/70 text-lg">
                  Designed for ease of use across laptops, tablets, and desktop devices without app downloads.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: 'No Account Needed', desc: 'Students join by entering their name and a unique 6-digit exam code.' },
                { title: 'Hardware Setup Check', desc: 'Visual volume indicators verify microphone permissions before starting.' },
                { title: 'Timed Oral Questions', desc: 'Clear countdown timers keep student responses structured and paced.' },
                { title: 'One-Click Submission', desc: 'Recorded audio blobs are securely submitted to Supabase storage.' },
              ].map((card, i) => (
                <ScrollReveal key={i}>
                  <div className="p-6 rounded-card border border-primary-teal/15 bg-bg-light dark:bg-deep-teal/30 h-full">
                    <h3 className="font-bold text-deep-teal dark:text-white font-poppins mb-2">{card.title}</h3>
                    <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{card.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 4: AI EVALUATION DIMENSIONS */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-16">
                <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Evaluation Criteria</span>
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mt-2">
                  Verified Evaluation Dimensions
                </h2>
                <p className="text-text-dark/70 dark:text-light-mint/70 mt-2 text-sm">
                  Google Gemini 2.5 Flash analyzes spoken transcripts across four specific criteria defined in the platform.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: 'Content Correctness',
                  metric: 'contentScore',
                  desc: 'Measures conceptual alignment and core factual understanding against the teacher model answer.',
                },
                {
                  title: 'Fluency & Delivery',
                  metric: 'fluencyScore',
                  desc: 'Evaluates spoken phrasing continuity, sentence flow, and articulation clarity from transcripts.',
                },
                {
                  title: 'Vocabulary Usage',
                  metric: 'vocabularyScore',
                  desc: 'Assesses subject-matter terminology, academic vocabulary, and appropriate lexical choices.',
                },
                {
                  title: 'Grammar & Syntax',
                  metric: 'grammarScore',
                  desc: 'Checks grammatical accuracy, correct clause structure, and spoken syntax integrity.',
                },
              ].map((dim, index) => (
                <ScrollReveal key={index}>
                  <div className="bg-white dark:bg-dark-surface p-6 rounded-card-lg border border-primary-teal/20 shadow-sm h-full flex flex-col justify-between">
                    <div>
                      <span className="inline-block text-xs font-mono px-2 py-1 bg-primary-teal/10 text-primary-teal rounded mb-3 font-semibold">
                        {dim.metric}
                      </span>
                      <h3 className="text-lg font-bold font-poppins text-deep-teal dark:text-white mb-2">
                        {dim.title}
                      </h3>
                      <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">
                        {dim.desc}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-primary-teal/10 text-[11px] text-text-dark/50 dark:text-light-mint/50">
                      Scored 0–100 scale • Stored in DB
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 5: TEACHER CONTROL */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <div className="space-y-6">
                  <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Educator Empowerment</span>
                  <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white leading-tight">
                    Teachers Retain 100% Control Over Final Grades
                  </h2>
                  <p className="text-text-dark/70 dark:text-light-mint/70 leading-relaxed text-sm">
                    Examly is engineered as a teacher assistance tool, not an autonomous replacement. Educators have complete visibility into every student submission.
                  </p>
                  <ul className="space-y-3 text-sm text-text-dark/80 dark:text-light-mint/80">
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <strong>Raw Audio Playback:</strong> Listen to student recordings directly in the teacher dashboard.
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <strong>Transcript Reader:</strong> Inspect exact Deepgram transcripts alongside student responses.
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <strong>One-Click Score Override:</strong> Update any score field manually when human evaluation differs.
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              <ScrollReveal>
                <div className="p-6 rounded-card-lg bg-deep-teal text-white border border-primary-teal/30 shadow-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-light-mint/20 pb-3">
                    <span className="text-xs font-semibold text-light-mint/70">STUDENT SESSION REVIEW</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-primary-teal/30 text-light-mint">Completed</span>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-white">Audio Recording & Transcript</div>
                    <div className="p-3 bg-white/5 rounded border border-white/10 text-xs text-light-mint/80 italic">
                      &quot;Photosynthesis converts solar energy into chemical energy stored in glucose molecules...&quot;
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-2.5 bg-white/5 rounded border border-white/10">
                      <div className="text-[10px] text-light-mint/60">AI COMPOSITE SCORE</div>
                      <div className="text-lg font-bold text-light-mint">88 / 100</div>
                    </div>
                    <div className="p-2.5 bg-white/10 rounded border border-primary-teal/40">
                      <div className="text-[10px] text-light-mint/80">TEACHER OVERRIDE SCORE</div>
                      <div className="text-lg font-bold text-white">92 / 100</div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* SECTION 6: EXAM INTEGRITY */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-12">
                <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Exam Integrity</span>
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mt-2">
                  Academic Integrity & Anti-Collusion Features
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ScrollReveal>
                <div className="bg-white dark:bg-dark-surface p-6 rounded-card-lg border border-primary-teal/20 h-full">
                  <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white mb-3">
                    Tab-Switch & Focus Tracking
                  </h3>
                  <p className="text-text-dark/70 dark:text-light-mint/70 text-sm leading-relaxed mb-4">
                    Examly monitors window focus events during active exam sessions. When a student switches browser tabs or minimizes the window, the platform logs the occurrence in <code className="text-xs bg-gray-100 dark:bg-deep-teal px-1 py-0.5 rounded">student_sessions.tab_switch_count</code>.
                  </p>
                  <span className="text-xs text-primary-teal font-semibold">Flagged sessions are highlighted in the teacher dashboard.</span>
                </div>
              </ScrollReveal>

              <ScrollReveal>
                <div className="bg-white dark:bg-dark-surface p-6 rounded-card-lg border border-primary-teal/20 h-full">
                  <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white mb-3">
                    Question Model Variants
                  </h3>
                  <p className="text-text-dark/70 dark:text-light-mint/70 text-sm leading-relaxed mb-4">
                    Teachers can configure multiple question model variants (Model A, Model B). When students join an exam session, Examly distributes distinct variant models to reduce question sharing and collusion.
                  </p>
                  <span className="text-xs text-primary-teal font-semibold">Random variant assignment at student join stage.</span>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* SECTION 7: PDF-TO-EXAM GENERATION */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-5xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mb-4">
                Automated Question Generation from PDFs
              </h2>
              <p className="text-text-dark/70 dark:text-light-mint/70 max-w-2xl mx-auto text-base mb-8">
                Upload course syllabi, lecture slides, or textbook chapters in PDF format. Google Gemini parses document text to extract structured oral exam questions and reference answers for teacher review.
              </p>
              <Link href="/signup">
                <Button variant="primary">
                  Try PDF Question Generator
                </Button>
              </Link>
            </ScrollReveal>
          </div>
        </section>

        {/* SECTION 8: FAQ PREVIEW */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white">Frequently Asked Questions</h2>
                <p className="text-sm text-text-dark/70 dark:text-light-mint/70 mt-2">Quick answers about Examly AI oral exams</p>
              </div>
            </ScrollReveal>

            <div className="space-y-4">
              {previewFaqs.map((faq, i) => (
                <ScrollReveal key={i}>
                  <div className="bg-white dark:bg-dark-surface p-6 rounded-card border border-primary-teal/15">
                    <h3 className="font-bold text-deep-teal dark:text-white font-poppins text-base mb-2">{faq.question}</h3>
                    <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{faq.answer}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <div className="text-center mt-8">
              <Link href="/faq" className="text-primary-teal hover:underline font-semibold text-sm">
                View All Frequently Asked Questions →
              </Link>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-deep-teal text-white text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold font-poppins mb-4">Ready to Run AI-Powered Oral Exams?</h2>
            <p className="text-light-mint/80 mb-8 text-base">
              Create your free account today and start creating oral assessments with complete grading control.
            </p>
            <Link href="/signup">
              <Button variant="primary" className="px-8 py-4 text-base">
                Get Started Free
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
