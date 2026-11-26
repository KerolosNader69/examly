import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ScrollReveal from '@/components/ui/ScrollReveal';
import Button from '@/components/ui/Button';
import { getBreadcrumbSchema, getOrganizationSchema, getFAQPageSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'AI-Assisted Viva Voce Examinations | Examly',
  description: 'Streamline university viva voce exams with browser voice recording, speech-to-text transcription, AI response evaluation, and professor score overrides.',
  alternates: {
    canonical: '/ai-viva-exams',
  },
  openGraph: {
    title: 'AI-Assisted Viva Voce Examinations | Examly',
    description: 'Streamline university viva voce exams with browser voice recording, speech-to-text transcription, AI response evaluation, and professor score overrides.',
    url: 'https://examly.site/ai-viva-exams',
    siteName: 'Examly',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Examly AI Viva Exams' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI-Assisted Viva Voce Examinations | Examly',
    description: 'Streamline university viva voce exams with browser voice recording, speech-to-text transcription, AI response evaluation, and professor score overrides.',
    images: ['/og-image.png'],
  },
};

const vivaFaqs = [
  {
    question: 'What is a viva voce exam?',
    answer: 'A viva voce is an oral examination where students answer spoken questions to demonstrate conceptual understanding, technical knowledge, and subject mastery.',
  },
  {
    question: 'How does Examly help professors conduct viva exams?',
    answer: 'Examly allows students to record spoken responses asynchronously. Deepgram transcribes spoken answers, Gemini evaluates conceptual correctness against model answers, and professors review audio recordings and override scores.',
  },
  {
    question: 'Can Examly handle different question variants for large cohorts?',
    answer: 'Yes. Professors can configure multiple question models (Model A, Model B) that are randomly assigned when students join the exam session.',
  },
];

export default function AiVivaExamsPage() {
  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Home', item: '/' },
    { name: 'AI Viva Exams', item: '/ai-viva-exams' },
  ]);
  const faqSchema = getFAQPageSchema(vivaFaqs);
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
              Academic Viva Voce Assessment Engine
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-poppins mb-6 leading-tight">
              AI-Assisted <span className="gradient-text">Viva Voce</span> Examinations
            </h1>
            <p className="text-lg sm:text-xl text-light-mint/90 max-w-2xl mx-auto mb-8 leading-relaxed">
              Scale university viva voce assessments without sacrificing academic rigor. Capture student spoken responses, generate accurate speech transcripts, evaluate conceptual understanding, and maintain complete professor oversight.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button variant="primary" className="w-full sm:w-auto text-base px-8 py-4">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/for-universities">
                <Button variant="outline" className="w-full sm:w-auto text-base text-white border-light-mint/40 hover:bg-light-mint/10 px-8 py-4">
                  Explore University Solutions
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 1: WHAT IS A VIVA VOCE EXAM? */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mb-4">
                  What Is a Viva Voce Examination?
                </h2>
                <p className="text-lg text-text-dark/70 dark:text-light-mint/70 leading-relaxed">
                  A viva voce (Latin for &quot;with living voice&quot;) is an oral examination widely used in higher education to assess a candidate&apos;s verbal explanation of concepts, problem-solving reasoning, and technical depth.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Verbal Knowledge Expression',
                  desc: 'Tests whether students can articulate core concepts verbally rather than relying on multiple-choice guessing.',
                },
                {
                  title: 'Depth of Understanding',
                  desc: 'Evaluates reasoning behind answers, subject-matter terminology usage, and conceptual synthesis.',
                },
                {
                  title: 'Authentic Student Voice',
                  desc: 'Provides a direct representation of student understanding that written exams alone cannot capture.',
                },
              ].map((card, i) => (
                <ScrollReveal key={i}>
                  <div className="p-6 rounded-card-lg bg-bg-light dark:bg-deep-teal/30 border border-primary-teal/15 h-full">
                    <h3 className="font-bold text-deep-teal dark:text-white font-poppins text-lg mb-2">{card.title}</h3>
                    <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{card.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 2: CHALLENGES OF TRADITIONAL VIVA EXAMS */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mb-4">
                  Challenges of Traditional Viva Examinations
                </h2>
                <p className="text-text-dark/70 dark:text-light-mint/70 text-base">
                  Why university departments struggle to conduct 1-on-1 oral assessments at scale.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: 'Scheduling Bottlenecks',
                  desc: 'Conducting individual 15-minute viva interviews for 200 students requires over 50 hours of continuous faculty time.',
                },
                {
                  title: 'Manual Review Burden',
                  desc: 'Faculty must manually document notes, evaluate responses on the fly, and grade spoken answers without persistent recordings.',
                },
                {
                  title: 'Inconsistent Documentation',
                  desc: 'Without automated transcripts and audio storage, cross-examiner grade validation and grade appeal reviews are difficult.',
                },
              ].map((item, idx) => (
                <ScrollReveal key={idx}>
                  <div className="bg-white dark:bg-dark-surface p-6 rounded-card-lg border border-primary-teal/20 shadow-sm h-full">
                    <h3 className="text-lg font-bold font-poppins text-deep-teal dark:text-white mb-2">{item.title}</h3>
                    <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: HOW EXAMLY SUPPORTS VIVA EXAMS */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-16">
                <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Workflow Streamlining</span>
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mt-2">
                  How Examly Modernizes University Viva Workflows
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { step: '1', title: 'Create Questions & Reference Rubrics', desc: 'Professors define viva questions and model answers, or generate them from PDF syllabus uploads.' },
                { step: '2', title: 'Assign Question Model Variants', desc: 'Configure Model A and Model B variants to distribute distinct question sets across student cohorts.' },
                { step: '3', title: 'Asynchronous Voice Recording', desc: 'Students join via code or direct URL and record oral responses to timed questions in their browser.' },
                { step: '4', title: 'STT, AI Scoring & Faculty Review', desc: 'Deepgram transcribes speech, Gemini scores understanding, and professors review audio and finalize grades.' },
              ].map((step, i) => (
                <ScrollReveal key={i}>
                  <div className="bg-bg-light dark:bg-deep-teal/30 p-6 rounded-card-lg border border-primary-teal/15 h-full relative">
                    <span className="w-8 h-8 rounded-full bg-primary-teal text-white font-bold flex items-center justify-center text-sm mb-4">
                      {step.step}
                    </span>
                    <h3 className="font-bold text-deep-teal dark:text-white font-poppins text-base mb-2">{step.title}</h3>
                    <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{step.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 4: AI EVALUATION FOR VIVA RESPONSES */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mb-4">
                  Multi-Criterion AI Evaluation for Spoken Answers
                </h2>
                <p className="text-text-dark/70 dark:text-light-mint/70 text-sm">
                  Transcribed responses are evaluated against professor reference answers using four structured metrics.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { title: 'Content & Conceptual Correctness', desc: 'Evaluates key technical principles, facts, and logical accuracy present in the student spoken response.' },
                { title: 'Fluency & Delivery Continuity', desc: 'Measures spoken flow, continuity of expression, and clarity of phrasing extracted from Deepgram transcripts.' },
                { title: 'Technical Vocabulary Usage', desc: 'Checks appropriate subject-matter jargon, terminology, and domain-specific vocabulary.' },
                { title: 'Grammar & Spoken Syntax', desc: 'Analyzes sentence structure correctness and grammatical coherence of the transcribed text.' },
              ].map((dim, idx) => (
                <ScrollReveal key={idx}>
                  <div className="bg-white dark:bg-dark-surface p-6 rounded-card border border-primary-teal/20">
                    <h3 className="font-bold font-poppins text-deep-teal dark:text-white text-base mb-2">{dim.title}</h3>
                    <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{dim.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 5: QUESTION VARIANTS & PDF GENERATION */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <ScrollReveal>
                <div className="space-y-4">
                  <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Anti-Collusion</span>
                  <h3 className="text-2xl sm:text-3xl font-bold font-poppins text-deep-teal dark:text-white">
                    Multi-Model Question Variants
                  </h3>
                  <p className="text-text-dark/70 dark:text-light-mint/70 text-sm leading-relaxed">
                    To reduce collusion when assessing large student cohorts asynchronously, Examly supports creating multiple question variants (Model A, Model B). When a student joins an exam session, the platform randomly assigns a variant model.
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal>
                <div className="space-y-4">
                  <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Syllabus Import</span>
                  <h3 className="text-2xl sm:text-3xl font-bold font-poppins text-deep-teal dark:text-white">
                    PDF to Viva Questions
                  </h3>
                  <p className="text-text-dark/70 dark:text-light-mint/70 text-sm leading-relaxed">
                    Upload course outlines, lecture notes, or textbook PDFs via <code className="text-xs bg-gray-100 dark:bg-deep-teal px-1 py-0.5 rounded">/api/exam/generate-from-pdf</code>. Google Gemini analyzes the text to extract viva questions and reference answers for professor approval.
                  </p>
                </div>
              </ScrollReveal>
            </div>

            {/* CLASSWIDE INSIGHTS */}
            <ScrollReveal>
              <div className="p-8 rounded-card-lg bg-deep-teal text-white border border-primary-teal/30">
                <span className="text-xs font-semibold text-light-mint/80 uppercase tracking-wider block mb-2">COHORT ANALYTICS</span>
                <h3 className="text-2xl font-bold font-poppins mb-3">Class-Wide AI Insights</h3>
                <p className="text-light-mint/80 text-sm leading-relaxed max-w-3xl">
                  After exam completion, professors can generate cohort-level synthesis reports (`/api/exam/generate-insights`). Gemini analyzes all student transcripts to identify common misconceptions, recurring errors, and overall topic mastery across the class.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* SECTION 6: UNIVERSITY USE CASES */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white">University Use Cases</h2>
                <p className="text-text-dark/70 dark:text-light-mint/70 text-sm mt-2">Versatile application across academic disciplines</p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Computer Science & Engineering', desc: 'Assess verbal explanations of algorithms, software design patterns, and system architecture principles.' },
                { title: 'Medical & Life Sciences', desc: 'Evaluate spoken diagnostic reasoning, clinical case study explanations, and anatomical knowledge.' },
                { title: 'Humanities & Social Sciences', desc: 'Grade spoken argument structure, historical analysis, and theoretical conceptualizations.' },
              ].map((uc, i) => (
                <ScrollReveal key={i}>
                  <div className="bg-white dark:bg-dark-surface p-6 rounded-card border border-primary-teal/15 h-full">
                    <h3 className="font-bold text-deep-teal dark:text-white font-poppins text-base mb-2">{uc.title}</h3>
                    <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{uc.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-deep-teal text-white text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold font-poppins mb-4">Transform Your University Viva Examinations</h2>
            <p className="text-light-mint/80 mb-8 text-base">
              Conduct oral viva assessments at scale with automated speech transcription, AI evaluation, and total professor control.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button variant="primary" className="w-full sm:w-auto px-8 py-4 text-base">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/for-universities">
                <Button variant="outline" className="w-full sm:w-auto text-white border-light-mint/40 hover:bg-light-mint/10">
                  University Solutions
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
