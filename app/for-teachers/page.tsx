import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ScrollReveal from '@/components/ui/ScrollReveal';
import Button from '@/components/ui/Button';
import { getBreadcrumbSchema, getOrganizationSchema, getFAQPageSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Oral Exam Software for Teachers | Examly',
  description: 'Empower your classroom with AI-assisted oral assessments. Generate questions from PDFs, track tab switches, review spoken audio, and override scores anytime.',
  alternates: {
    canonical: '/for-teachers',
  },
  openGraph: {
    title: 'Oral Exam Software for Teachers | Examly',
    description: 'Empower your classroom with AI-assisted oral assessments. Generate questions from PDFs, track tab switches, review spoken audio, and override scores anytime.',
    url: 'https://examly.site/for-teachers',
    siteName: 'Examly',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Examly for Teachers' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Oral Exam Software for Teachers | Examly',
    description: 'Empower your classroom with AI-assisted oral assessments. Generate questions from PDFs, track tab switches, review spoken audio, and override scores anytime.',
    images: ['/og-image.png'],
  },
};

const teacherFaqs = [
  {
    question: 'How long does it take a teacher to create an oral exam?',
    answer: 'Creating an exam takes less than two minutes. You can enter questions manually or upload a course syllabus PDF to auto-extract structured questions and reference answers.',
  },
  {
    question: 'Can I edit the AI-generated scores?',
    answer: 'Yes. Teachers can listen to student audio recordings, read the exact Deepgram transcript, and override any score field manually in the teacher dashboard.',
  },
  {
    question: 'Do my students need to download an app or log in?',
    answer: 'No. Students join by clicking a direct exam URL or entering a 6-digit access code in their web browser.',
  },
];

export default function ForTeachersPage() {
  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Home', item: '/' },
    { name: 'For Teachers', item: '/for-teachers' },
  ]);
  const faqSchema = getFAQPageSchema(teacherFaqs);
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
              Educator Command Center
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-poppins mb-6 leading-tight">
              Run and Review Oral Exams with <span className="gradient-text">AI Assistance</span>
            </h1>
            <p className="text-lg sm:text-xl text-light-mint/90 max-w-2xl mx-auto mb-8 leading-relaxed">
              Automate oral assessment busywork. Create exams manually or from PDF uploads, share access codes with students, review audio recordings & transcripts, and retain complete score control.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button variant="primary" className="w-full sm:w-auto text-base px-8 py-4">
                  Create an Exam Free
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" className="w-full sm:w-auto text-base text-white border-light-mint/40 hover:bg-light-mint/10 px-8 py-4">
                  Explore Teacher Features
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 1: CREATE AN EXAM & PDF GENERATION */}
        <section id="features" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-16">
                <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Exam Setup</span>
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mt-2">
                  Create Oral Assessments in Minutes
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ScrollReveal>
                <div className="p-8 rounded-card-lg bg-bg-light dark:bg-deep-teal/30 border border-primary-teal/20 h-full">
                  <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white mb-3">Manual Exam Creation</h3>
                  <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed mb-4">
                    Specify exam title, timed duration per question, and question type (`oral`, `audio`). Define reference model answers that guide the AI evaluation engine.
                  </p>
                  <ul className="space-y-2 text-xs text-text-dark/80 dark:text-light-mint/80">
                    <li className="flex items-center gap-2">✓ Timed question countdowns</li>
                    <li className="flex items-center gap-2">✓ Reference model answer configuration</li>
                    <li className="flex items-center gap-2">✓ Multi-model question variants (Model A / Model B)</li>
                  </ul>
                </div>
              </ScrollReveal>

              <ScrollReveal>
                <div className="p-8 rounded-card-lg bg-bg-light dark:bg-deep-teal/30 border border-primary-teal/20 h-full">
                  <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white mb-3">PDF-to-Question Generator</h3>
                  <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed mb-4">
                    Upload syllabus, lecture slides, or textbook chapter PDFs directly in `CreateExamModal`. Google Gemini extracts key concepts to build structured viva questions automatically.
                  </p>
                  <ul className="space-y-2 text-xs text-text-dark/80 dark:text-light-mint/80">
                    <li className="flex items-center gap-2">✓ One-click PDF upload parsing</li>
                    <li className="flex items-center gap-2">✓ Auto-extracted questions and reference answers</li>
                    <li className="flex items-center gap-2">✓ Full teacher edit control before publishing</li>
                  </ul>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* SECTION 2: SHARE WITH STUDENTS & REVIEW RESPONSES */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-16">
                <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Teacher Workflow</span>
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mt-2">
                  Share Easily, Review Thoroughly
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Share Access Code',
                  desc: 'Publish your exam to generate a 6-digit access code or direct URL. Students join immediately with zero account creation required.',
                },
                {
                  title: 'Inspect Recordings & Transcripts',
                  desc: 'Listen to student voice recordings stored securely in Supabase Storage and read Deepgram Nova-3 speech transcripts side-by-side.',
                },
                {
                  title: 'Review Tab-Switch Flags',
                  desc: 'Inspect automated tab-switch logs (`tab_switch_count`) to verify exam window focus integrity during active sessions.',
                },
              ].map((card, idx) => (
                <ScrollReveal key={idx}>
                  <div className="bg-white dark:bg-dark-surface p-6 rounded-card border border-primary-teal/20 h-full">
                    <h3 className="font-bold text-deep-teal dark:text-white font-poppins text-base mb-2">{card.title}</h3>
                    <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{card.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: STAY IN CONTROL (TEACHER OVERRIDE) */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <div className="space-y-4">
                  <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Grading Authority</span>
                  <h2 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white">
                    You Always Have the Final Say
                  </h2>
                  <p className="text-text-dark/70 dark:text-light-mint/70 text-sm leading-relaxed">
                    Examly provides preliminary scores for content, fluency, vocabulary, and grammar. If you disagree with an AI evaluation, update the grade instantly using `teacher_override_score`.
                  </p>
                  <p className="text-text-dark/70 dark:text-light-mint/70 text-sm leading-relaxed">
                    The platform saves your override score as the authoritative grade while maintaining full audit visibility.
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal>
                <div className="p-6 rounded-card-lg bg-deep-teal text-white border border-primary-teal/30 space-y-4">
                  <h3 className="font-bold text-sm text-light-mint border-b border-light-mint/20 pb-2">TEACHER DASHBOARD SCORE OVERRIDE</h3>
                  <div className="p-3 bg-white/5 rounded border border-white/10 text-xs">
                    <div className="text-light-mint/70 mb-1">AI Composite Score: <span className="text-white font-bold">84 / 100</span></div>
                    <div className="text-light-mint/70">Teacher Override Score: <span className="text-light-mint font-bold">90 / 100</span> (Saved)</div>
                  </div>
                  <p className="text-[11px] text-light-mint/60 italic">
                    Overrides are stored directly in `student_sessions.teacher_override_score`.
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* SECTION 4: CLASS INSIGHTS & REPORTS */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white">Class Analytics & Grade Export Reports</h2>
                <p className="text-text-dark/70 dark:text-light-mint/70 text-sm mt-2">Tools to analyze student cohort progress</p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Classwide AI Insights', desc: 'Synthesize student transcripts into cohort-wide misconception summaries and learning gap reports.' },
                { title: 'CSV Grade Export', desc: 'Export student roster completion data, AI scores, and teacher overrides in standard CSV format.' },
                { title: 'PDF Report Export', desc: 'Generate printable PDF grade reports for individual student records or department archives.' },
              ].map((rep, i) => (
                <ScrollReveal key={i}>
                  <div className="bg-white dark:bg-dark-surface p-6 rounded-card border border-primary-teal/15 h-full">
                    <h3 className="font-bold text-deep-teal dark:text-white font-poppins text-base mb-2">{rep.title}</h3>
                    <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{rep.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-deep-teal text-white text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold font-poppins mb-4">Ready to Modernize Your Classroom Oral Exams?</h2>
            <p className="text-light-mint/80 mb-8 text-base">
              Create your free teacher account today and experience AI-assisted oral assessments.
            </p>
            <Link href="/signup">
              <Button variant="primary" className="px-8 py-4 text-base">
                Create an Exam Free
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
