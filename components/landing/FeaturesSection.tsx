import React from 'react';
import ScrollReveal from '../ui/ScrollReveal';

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-poppins text-deep-teal mb-4">
              Academic Integrity at Scale
            </h2>
            <p className="text-lg text-text-dark/70 max-w-2xl mx-auto">
              Built for educators, designed to eliminate grading bias and streamline the examination process.
            </p>
          </div>
        </ScrollReveal>

        {/* Top 3 Cards - Equal Height */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Feature 1 - AI-Powered Grading */}
          <ScrollReveal>
            <div className="bg-bg-light rounded-card-lg border border-primary-teal/20 shadow-sm p-6 flex flex-col h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
              <div className="w-12 h-12 rounded-card bg-primary-teal/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold font-poppins text-deep-teal mb-2">
                AI-Powered Grading
              </h3>
              <p className="text-sm text-text-dark/70 mb-6 flex-grow">
                Our proprietary model analyzes pronunciation, vocabulary, and grammar in real-time, providing immediate, objective feedback aligned with standard rubrics.
              </p>
              <div className="mt-auto bg-white rounded-card h-32 border border-primary-teal/10 relative overflow-hidden flex items-center justify-center">
                <div className="flex items-end h-16 gap-1 opacity-70">
                  <div className="w-2 bg-primary-teal rounded-t animate-pulse" style={{ height: '40%', animationDuration: '1.5s' }}></div>
                  <div className="w-2 bg-primary-teal rounded-t animate-pulse" style={{ height: '70%', animationDuration: '1.5s', animationDelay: '0.2s' }}></div>
                  <div className="w-2 bg-primary-teal rounded-t animate-pulse" style={{ height: '90%', animationDuration: '1.5s', animationDelay: '0.4s' }}></div>
                  <div className="w-2 bg-primary-teal rounded-t animate-pulse" style={{ height: '60%', animationDuration: '1.5s', animationDelay: '0.1s' }}></div>
                  <div className="w-2 bg-primary-teal rounded-t animate-pulse" style={{ height: '80%', animationDuration: '1.5s', animationDelay: '0.5s' }}></div>
                  <div className="w-2 bg-primary-teal rounded-t animate-pulse" style={{ height: '100%', animationDuration: '1.5s', animationDelay: '0.3s' }}></div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Feature 2 - Real-time Voice Analysis */}
          <ScrollReveal>
            <div className="bg-bg-light rounded-card-lg border border-primary-teal/20 shadow-sm p-6 flex flex-col h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
              <div className="w-12 h-12 rounded-card bg-light-mint/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold font-poppins text-deep-teal mb-2">
                Real-time Voice Analysis
              </h3>
              <p className="text-sm text-text-dark/70 mb-6 flex-grow">
                Detect hesitation, fluency issues, and exact keyword usage as the student speaks.
              </p>
              <div className="mt-auto flex justify-center py-4 h-32 items-center">
                <svg className="w-16 h-16 text-primary-teal/40 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>
          </ScrollReveal>

          {/* Feature 3 - Secure Environment */}
          <ScrollReveal>
            <div className="bg-bg-light rounded-card-lg border border-primary-teal/20 shadow-sm p-6 flex flex-col h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
              <div className="w-12 h-12 rounded-card bg-gold-accent/20 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gold-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold font-poppins text-deep-teal mb-2">
                Secure Environment
              </h3>
              <p className="text-sm text-text-dark/70 flex-grow">
                Browser lockdown and identity verification ensure examination integrity.
              </p>
              <div className="h-32"></div>
            </div>
          </ScrollReveal>
        </div>

        {/* Bottom Card - Full Width */}
        <ScrollReveal>
          <div className="bg-bg-light rounded-card-lg border border-primary-teal/20 shadow-sm p-6 flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
            <div className="w-12 h-12 rounded-card bg-light-mint/30 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold font-poppins text-deep-teal mb-2">
              Comprehensive Analytics Dashboard
            </h3>
            <p className="text-sm text-text-dark/70">
              Track cohort performance, identify common learning gaps, and export detailed reports for accreditation bodies.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
