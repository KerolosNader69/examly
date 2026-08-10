import React from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ScrollReveal from '@/components/ui/ScrollReveal';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us - Examly',
  description: 'Learn about Examly and our mission to transform oral assessments with AI.',
};

const values = [
  {
    title: 'Fairness First',
    desc: 'AI grading eliminates unconscious bias, giving every student an equal opportunity to demonstrate their knowledge.',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    title: 'Teacher Empowerment',
    desc: 'We build tools that put teachers back in control — automating the busywork while preserving their judgment.',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    title: 'Accessible Learning',
    desc: 'Students can take exams from any device, anywhere — making oral assessment available to everyone.',
    icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
  },
];

const milestones = [
  { year: '2025', title: 'The idea is born', desc: 'Examly started with a simple question: why are oral exams so hard to scale?' },
  { year: '2026', title: 'AI Grading Engine', desc: 'Our proprietary pronunciation, vocabulary, and fluency models reached production quality.' },
  { year: '2026', title: '1,000+ schools', desc: 'Teachers across the world adopted Examly for their oral assessments.' },
  { year: 'Today', title: 'The future of assessment', desc: 'We continue to push the boundaries of what fair, efficient assessment looks like.' },
];

export default function AboutPage() {
  return (
    <>
      <Header />
      <main>
        {/* Hero */}
        <section className="bg-deep-teal relative overflow-hidden">
          <div className="absolute inset-0 hero-pattern opacity-30"></div>
          <div className="absolute -top-32 right-0 w-96 h-96 bg-primary-teal/20 rounded-full blur-3xl"></div>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative z-10 text-center">
            <h1 className="text-4xl md:text-5xl font-bold font-poppins text-white mb-6">
              We&apos;re Building the Future of <span className="gradient-text">Oral Assessment</span>
            </h1>
            <p className="text-lg text-light-mint/80 max-w-2xl mx-auto">
              Examly was founded on a simple belief: every student deserves fair, consistent, and meaningful oral assessment — and every teacher deserves their time back.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <ScrollReveal>
              <div className="max-w-3xl mx-auto text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold font-poppins text-deep-teal dark:text-white mb-4">Our Mission</h2>
                <p className="text-lg text-text-dark/70 dark:text-light-mint/70 leading-relaxed">
                  Traditional oral exams are time-consuming, difficult to standardize, and prone to bias. We built Examly to change that — using AI to grade pronunciation, vocabulary, and fluency consistently, while giving teachers complete oversight of every result.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {values.map((value, i) => (
                <ScrollReveal key={i}>
                  <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-8 h-full text-center">
                    <div className="w-14 h-14 mx-auto rounded-card bg-primary-teal/10 flex items-center justify-center mb-5">
                      <svg className="w-7 h-7 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={value.icon} />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold font-poppins text-deep-teal dark:text-white mb-3">{value.title}</h3>
                    <p className="text-text-dark/70 dark:text-light-mint/70">{value.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Milestones */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-deep-teal">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <h2 className="text-3xl md:text-4xl font-bold font-poppins text-deep-teal dark:text-white text-center mb-16">Our Journey</h2>
            </ScrollReveal>
            <div className="relative">
              <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-primary-teal/20"></div>
              <div className="space-y-12">
                {milestones.map((milestone, i) => (
                  <ScrollReveal key={i}>
                    <div className={`relative flex md:items-center ${i % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                      <div className="absolute left-4 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary-teal ring-4 ring-light-mint/30"></div>
                      <div className={`ml-12 md:ml-0 md:w-1/2 ${i % 2 === 0 ? 'md:pr-12' : 'md:pl-12'}`}>
                        <div className="bg-bg-light dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 p-6 hover:shadow-lg transition-shadow">
                          <span className="text-sm font-bold text-primary-teal">{milestone.year}</span>
                          <h3 className="text-lg font-semibold font-poppins text-deep-teal dark:text-white mt-1">{milestone.title}</h3>
                          <p className="text-sm text-text-dark/70 dark:text-light-mint/70 mt-2">{milestone.desc}</p>
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-poppins text-deep-teal dark:text-white mb-4">Join Us</h2>
            <p className="text-lg text-text-dark/70 dark:text-light-mint/70 mb-8">
              We&apos;re just getting started. Create your free account and see the future of oral assessment.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-card bg-primary-teal text-white font-semibold text-lg hover:bg-light-mint transition-all duration-200 shadow-lg"
            >
              Get Started Free
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
