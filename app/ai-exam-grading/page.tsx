import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ScrollReveal from '@/components/ui/ScrollReveal';
import Button from '@/components/ui/Button';
import { getBreadcrumbSchema, getOrganizationSchema, getFAQPageSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'AI-Assisted Oral Exam Grading Engine | Examly',
  description: 'Explore Examly\'s evaluation pipeline: speech-to-text transcription, semantic evaluation by an AI grading provider, and 100% teacher score override control.',
  alternates: {
    canonical: '/ai-exam-grading',
  },
  openGraph: {
    title: 'AI-Assisted Oral Exam Grading Engine | Examly',
    description: 'Explore Examly\'s evaluation pipeline: speech-to-text transcription, semantic evaluation by an AI grading provider, and 100% teacher score override control.',
    url: 'https://examly.site/ai-exam-grading',
    siteName: 'Examly',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Examly AI Exam Grading Engine' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI-Assisted Oral Exam Grading Engine | Examly',
    description: 'Explore Examly\'s evaluation pipeline: speech-to-text transcription, semantic evaluation by an AI grading provider, and 100% teacher score override control.',
    images: ['/og-image.png'],
  },
};

const gradingFaqs = [
  {
    question: 'How does Examly grade spoken student responses?',
    answer: 'Student spoken audio is recorded in the browser and transcribed by a speech-to-text provider. The text transcript is evaluated by an AI grading provider against teacher reference answers across content, fluency, vocabulary, and grammar.',
  },
  {
    question: 'Can teachers override AI-generated scores?',
    answer: 'Yes. Teachers can listen to student audio, read the speech-to-text transcript, inspect individual criterion scores, and override any score manually in the dashboard.',
  },
  {
    question: 'What happens if the speech-to-text mishears a word?',
    answer: 'Because speech-to-text models can occasionally encounter technical jargon artifacts, Examly is designed around human teacher review. Teachers inspect audio recordings and transcripts whenever an evaluation requires manual verification.',
  },
];

export default function AiExamGradingPage() {
  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Home', item: '/' },
    { name: 'AI Exam Grading', item: '/ai-exam-grading' },
  ]);
  const faqSchema = getFAQPageSchema(gradingFaqs);
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
              Speech-to-Text & Semantic Evaluation Pipeline
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-poppins mb-6 leading-tight">
              AI-Assisted <span className="gradient-text">Oral Exam Grading</span>
            </h1>
            <p className="text-lg sm:text-xl text-light-mint/90 max-w-2xl mx-auto mb-8 leading-relaxed">
              Examly automates speech transcription and preliminary oral response scoring using a speech-to-text provider and an AI grading provider, while preserving 100% human teacher override control.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button variant="primary" className="w-full sm:w-auto text-base px-8 py-4">
                  Try AI Grading Free
                </Button>
              </Link>
              <Link href="#pipeline">
                <Button variant="outline" className="w-full sm:w-auto text-base text-white border-light-mint/40 hover:bg-light-mint/10 px-8 py-4">
                  View Pipeline Tech
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 1: HOW AI GRADING WORKS (PIPELINE) */}
        <section id="pipeline" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-16">
                <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Technical Architecture</span>
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mt-2">
                  The Examly AI Evaluation Pipeline
                </h2>
                <p className="text-text-dark/70 dark:text-light-mint/70 text-sm mt-2">
                  Trace the exact flow from student microphone recording to final teacher review.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
              {[
                { title: 'Audio Capture', sub: 'MediaRecorder', desc: 'Browser records audio blob' },
                { title: 'STT Engine', sub: 'Speech-to-text provider', desc: 'Converts speech to text' },
                { title: 'Transcript', sub: 'Punctuation Format', desc: 'Structured text payload' },
                { title: 'AI Model', sub: 'AI grading provider', desc: 'Evaluates vs model answer' },
                { title: 'Score Breakdown', sub: '4 Dimensions', desc: 'Content, fluency, vocab, grammar' },
                { title: 'Teacher Control', sub: 'Score Override', desc: 'Human sign-off & edit' },
              ].map((step, i) => (
                <ScrollReveal key={i}>
                  <div className="bg-bg-light dark:bg-deep-teal/30 p-4 rounded-card border border-primary-teal/20 text-center h-full flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-primary-teal uppercase tracking-wider block mb-1">{step.sub}</span>
                      <h3 className="font-bold text-deep-teal dark:text-white font-poppins text-sm mb-1">{step.title}</h3>
                      <p className="text-[11px] text-text-dark/70 dark:text-light-mint/70 leading-tight">{step.desc}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 2: WHAT EXAMLY EVALUATES */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-16">
                <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Core Rubric</span>
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mt-2">
                  What Examly Evaluates
                </h2>
                <p className="text-text-dark/70 dark:text-light-mint/70 text-sm mt-2">
                  Four verified criteria calculated during response evaluation.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  number: '01',
                  title: 'Content Correctness',
                  desc: 'Evaluates conceptual accuracy, presence of key facts, and technical alignment with the teacher reference model answer.',
                },
                {
                  number: '02',
                  title: 'Fluency & Delivery',
                  desc: 'Assesses continuity of spoken thought, phrasing cadence, and delivery clarity derived from transcripts.',
                },
                {
                  number: '03',
                  title: 'Vocabulary Usage',
                  desc: 'Measures subject-matter terminology, academic word choices, and domain lexical diversity.',
                },
                {
                  number: '04',
                  title: 'Grammar & Syntax',
                  desc: 'Analyzes spoken sentence structure, clause alignment, and grammatical correctness of the transcribed response.',
                },
              ].map((card, idx) => (
                <ScrollReveal key={idx}>
                  <div className="bg-white dark:bg-dark-surface p-6 rounded-card-lg border border-primary-teal/20 h-full flex flex-col justify-between">
                    <div>
                      <span className="text-2xl font-black text-primary-teal/40 font-poppins block mb-2">{card.number}</span>
                      <h3 className="text-lg font-bold font-poppins text-deep-teal dark:text-white mb-2">{card.title}</h3>
                      <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{card.desc}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: SCORE BREAKDOWN & FEEDBACK */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <div className="space-y-4">
                  <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Structured Output</span>
                  <h2 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white">
                    Detailed Score Breakdown & Qualitative Feedback
                  </h2>
                  <p className="text-text-dark/70 dark:text-light-mint/70 text-sm leading-relaxed">
                    For every student submission, the AI grading provider returns individual 0–100 criterion scores alongside an overall composite score (`ai_score`) and a concise 2–3 sentence qualitative feedback summary (`feedback`).
                  </p>
                  <p className="text-text-dark/70 dark:text-light-mint/70 text-sm leading-relaxed">
                    This qualitative summary highlights student strengths and specific missing concepts, helping teachers understand the rationale behind the preliminary AI score.
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal>
                <div className="p-6 rounded-card-lg bg-deep-teal text-white border border-primary-teal/30 space-y-4">
                  <h3 className="font-bold text-sm text-light-mint border-b border-light-mint/20 pb-2">AI EVALUATION OUTPUT EXAMPLE</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2 bg-white/5 rounded">Content Score: <span className="font-bold text-light-mint">90/100</span></div>
                    <div className="p-2 bg-white/5 rounded">Fluency Score: <span className="font-bold text-light-mint">85/100</span></div>
                    <div className="p-2 bg-white/5 rounded">Vocabulary Score: <span className="font-bold text-light-mint">88/100</span></div>
                    <div className="p-2 bg-white/5 rounded">Grammar Score: <span className="font-bold text-light-mint">92/100</span></div>
                  </div>
                  <div className="p-3 bg-white/5 rounded border border-white/10 text-xs">
                    <span className="text-light-mint font-semibold block mb-1">AI Qualitative Feedback:</span>
                    &quot;The student clearly explained the core mechanism of action and correctly identified key terminology. Phrasing was coherent with minor pauses.&quot;
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* SECTION 4: AUDIO + TRANSCRIPT REVIEW & TEACHER OVERRIDE */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-5xl mx-auto space-y-12">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto">
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mb-4">
                  Audio & Transcript Inspection with Manual Override
                </h2>
                <p className="text-text-dark/70 dark:text-light-mint/70 text-sm">
                  Teachers maintain complete authority. When STT models encounter unusual accents or specialized technical jargon artifacts, educators can verify raw recordings and override scores with one click.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Raw Audio Playback', desc: 'Listen to student voice recordings stored securely with our database and storage provider.' },
                { title: 'Full Transcript Display', desc: 'Read exact speech-to-text transcripts generated from spoken audio.' },
                { title: 'One-Click Override', desc: 'Enter a custom score in `teacher_override_score` to replace AI preliminary grades.' },
              ].map((card, i) => (
                <ScrollReveal key={i}>
                  <div className="bg-white dark:bg-dark-surface p-6 rounded-card border border-primary-teal/20 h-full">
                    <h3 className="font-bold text-deep-teal dark:text-white font-poppins text-base mb-2">{card.title}</h3>
                    <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{card.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 5: CLASS INSIGHTS */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-4xl mx-auto text-center">
            <ScrollReveal>
              <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Cohort Analysis</span>
              <h2 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white mt-2 mb-4">
                Classwide AI Misconception Insights
              </h2>
              <p className="text-text-dark/70 dark:text-light-mint/70 text-sm leading-relaxed mb-6">
                Examly aggregates all student transcripts across an exam to synthesize cohort-level insights. Identify common student misconceptions and topic mastery gaps across your entire class.
              </p>
              <Link href="/signup">
                <Button variant="primary">
                  Explore Class Insights
                </Button>
              </Link>
            </ScrollReveal>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-deep-teal text-white text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold font-poppins mb-4">Start Grading Oral Exams with AI Assistance</h2>
            <p className="text-light-mint/80 mb-8 text-base">
              Combine state-of-the-art speech transcription with complete teacher control.
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
