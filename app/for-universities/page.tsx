import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ScrollReveal from '@/components/ui/ScrollReveal';
import Button from '@/components/ui/Button';
import UniversityDemoForm from '@/components/contact/UniversityDemoForm';
import { getBreadcrumbSchema, getOrganizationSchema, getFAQPageSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'AI-Assisted Oral Assessments for Universities | Examly',
  description: 'Scale university oral examinations with custom institutional subdomains, tab-switch tracking, PDF question generation, and complete faculty score override.',
  alternates: {
    canonical: '/for-universities',
  },
  openGraph: {
    title: 'AI-Assisted Oral Assessments for Universities | Examly',
    description: 'Scale university oral examinations with custom institutional subdomains, tab-switch tracking, PDF question generation, and complete faculty score override.',
    url: 'https://examly.site/for-universities',
    siteName: 'Examly',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Examly for Universities' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI-Assisted Oral Assessments for Universities | Examly',
    description: 'Scale university oral examinations with custom institutional subdomains, tab-switch tracking, PDF question generation, and complete faculty score override.',
    images: ['/og-image.png'],
  },
};

const universityFaqs = [
  {
    question: 'How does Examly support university custom branding?',
    answer: 'Examly supports custom subdomains (e.g. department.examly.site) along with custom institution logos and primary brand color themes stored in teacher settings.',
  },
  {
    question: 'How does Examly handle student data privacy?',
    answer: 'Student recordings, speech transcripts, and scores are stored securely using row-level security (RLS) policies and encrypted storage from our database and storage provider.',
  },
  {
    question: 'Does Examly replace faculty grading judgment?',
    answer: 'No. Examly provides preliminary scoring and transcription assistance. University professors retain 100% control to review recordings, read transcripts, and override scores.',
  },
];

export default function ForUniversitiesPage() {
  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Home', item: '/' },
    { name: 'For Universities', item: '/for-universities' },
  ]);
  const faqSchema = getFAQPageSchema(universityFaqs);
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
              Higher Education Assessment Architecture
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-poppins mb-6 leading-tight">
              AI-Assisted <span className="gradient-text">Oral Assessments</span> for Universities
            </h1>
            <p className="text-lg sm:text-xl text-light-mint/90 max-w-2xl mx-auto mb-8 leading-relaxed">
              Empower university faculty to scale oral exams and viva voce evaluations across large student cohorts with custom institution branding, tab-switch tracking, and complete professor score control.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="#demo-form">
                <Button variant="primary" className="w-full sm:w-auto text-base px-8 py-4">
                  Request University Demo
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" className="w-full sm:w-auto text-base text-white border-light-mint/40 hover:bg-light-mint/10 px-8 py-4">
                  View Institution Plans
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 1: UNIVERSITY ORAL ASSESSMENT WORKFLOW */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-16">
                <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Institutional Workflow</span>
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mt-2">
                  Standard University Exam Execution
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[
                { step: '01', title: 'Faculty Exam Setup', desc: 'Professors set reference answers or generate question sets from syllabus PDFs.' },
                { step: '02', title: 'Variant Distribution', desc: 'Randomly assign question models (Model A, Model B) across student groups.' },
                { step: '03', title: 'No-Login Student Join', desc: 'Students access exams via direct link or 6-digit access code without creating accounts.' },
                { step: '04', title: 'AI STT & Scoring', desc: 'A speech-to-text provider transcribes speech; an AI grading provider evaluates content, fluency, vocabulary, and grammar.' },
                { step: '05', title: 'Faculty Final Review', desc: 'Professors inspect audio playback, transcripts, and finalize score overrides.' },
              ].map((item, i) => (
                <ScrollReveal key={i}>
                  <div className="bg-bg-light dark:bg-deep-teal/30 p-5 rounded-card border border-primary-teal/15 h-full flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-primary-teal block mb-1">{item.step}</span>
                      <h3 className="font-bold text-deep-teal dark:text-white font-poppins text-sm mb-2">{item.title}</h3>
                      <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 2: CENTRALIZED MANAGEMENT & CUSTOM BRANDING */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <ScrollReveal>
                <div className="space-y-4">
                  <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Custom Subdomains</span>
                  <h3 className="text-2xl sm:text-3xl font-bold font-poppins text-deep-teal dark:text-white">
                    Institutional Subdomain Branding
                  </h3>
                  <p className="text-text-dark/70 dark:text-light-mint/70 text-sm leading-relaxed">
                    Examly resolves custom subdomains (e.g. <code className="text-xs bg-white dark:bg-deep-teal px-1 py-0.5 rounded">department.examly.site</code>) using <code className="text-xs bg-white dark:bg-deep-teal px-1 py-0.5 rounded">/api/teacher/by-subdomain</code>.
                  </p>
                  <p className="text-text-dark/70 dark:text-light-mint/70 text-sm leading-relaxed">
                    Display custom university logos, primary brand colors, and institution display names across student exam rooms.
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal>
                <div className="p-6 rounded-card-lg bg-white dark:bg-dark-surface border border-primary-teal/20 shadow-sm space-y-3">
                  <div className="text-xs font-bold text-primary-teal uppercase">Verified Institutional Features</div>
                  <ul className="space-y-2 text-xs text-text-dark/80 dark:text-light-mint/80">
                    <li className="flex items-center gap-2">✓ Custom Subdomains (`subdomain.examly.site`)</li>
                    <li className="flex items-center gap-2">✓ Custom University Logo & Primary Brand Color</li>
                    <li className="flex items-center gap-2">✓ System Admin Overview & Health Diagnostics</li>
                    <li className="flex items-center gap-2">✓ System Audit Logs (`/api/admin/audit-log`)</li>
                    <li className="flex items-center gap-2">✓ CSV & PDF Grade Export Reports</li>
                  </ul>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* SECTION 3: ACADEMIC INTEGRITY SUPPORT */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-12">
                <span className="text-primary-teal font-semibold text-sm tracking-wide uppercase">Exam Integrity</span>
                <h2 className="text-3xl sm:text-4xl font-bold font-poppins text-deep-teal dark:text-white mt-2">
                  Academic Integrity Mechanisms
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ScrollReveal>
                <div className="p-6 rounded-card-lg bg-bg-light dark:bg-deep-teal/30 border border-primary-teal/20 h-full">
                  <h3 className="text-lg font-bold font-poppins text-deep-teal dark:text-white mb-2">Tab Switch & Focus Monitoring</h3>
                  <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">
                    Examly tracks browser focus loss and tab switches during active sessions. Switch counts are stored in database records (`tab_switch_count`) to flag suspicious activity for faculty review.
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal>
                <div className="p-6 rounded-card-lg bg-bg-light dark:bg-deep-teal/30 border border-primary-teal/20 h-full">
                  <h3 className="text-lg font-bold font-poppins text-deep-teal dark:text-white mb-2">Question Model Randomization</h3>
                  <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">
                    Faculty can create distinct question models (Model A, Model B). The system randomly assigns a variant when students join, reducing collusion opportunities.
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* SECTION 4: SECURITY ARCHITECTURE */}
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg-light dark:bg-deep-teal/20">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white">Technical Security Architecture</h2>
                <p className="text-text-dark/70 dark:text-light-mint/70 text-sm mt-2">Built on modern, verified cloud security primitives</p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: 'Teacher Authentication', desc: 'Secure teacher authentication via encrypted JWT tokens.' },
                { title: 'Row-Level Security', desc: 'Database RLS policies enforce isolation between teacher accounts.' },
                { title: 'Protected AI APIs', desc: 'Server-side API routes execute AI prompts using protected service role keys.' },
                { title: 'Audit Logging', desc: 'Admin audit logs record system administrative actions and access events.' },
              ].map((sec, i) => (
                <ScrollReveal key={i}>
                  <div className="bg-white dark:bg-dark-surface p-5 rounded-card border border-primary-teal/15 h-full">
                    <h3 className="font-bold text-deep-teal dark:text-white font-poppins text-sm mb-2">{sec.title}</h3>
                    <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">{sec.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 5: DEMO FORM */}
        <section id="demo-form" className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-surface">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white mb-2">Request a University Demo</h2>
              <p className="text-text-dark/70 dark:text-light-mint/70 text-sm mb-8">
                Connect with our team to explore institutional pricing, custom subdomains, and university deployment options.
              </p>
              <UniversityDemoForm />
            </ScrollReveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
