import React from 'react';
import ScrollReveal from '../ui/ScrollReveal';

const steps = [
  {
    number: '01',
    title: 'Teacher Creates Exam',
    description: 'Set up questions, rubrics, and evaluation criteria in minutes.',
  },
  {
    number: '02',
    title: 'Student Joins with a Link',
    description: 'Share a secure link—students join instantly from any device.',
  },
  {
    number: '03',
    title: 'AI Grades, Teacher Reviews',
    description: 'AI provides instant grading while you maintain final oversight.',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="bg-white py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-poppins text-deep-teal mb-4">
              How It Works
            </h2>
            <p className="text-lg text-text-dark/70 max-w-2xl mx-auto">
              Three simple steps to transform your oral assessment process.
            </p>
          </div>
        </ScrollReveal>

        <div className="relative max-w-5xl mx-auto">
          {/* Connection Line - positioned to go through center of circles */}
          <div className="hidden lg:block absolute top-10 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-teal via-light-mint to-primary-teal"></div>
          
          {/* Animated moving ball on the line */}
          <div className="hidden lg:block absolute top-10 left-0 right-0 h-0.5 overflow-visible">
            <div className="moving-ball w-3 h-3 bg-gold-accent rounded-full shadow-lg" style={{ transform: 'translateY(-50%)' }}></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((step, index) => (
              <ScrollReveal key={index}>
                <div className="relative flex flex-col items-center">
                  <div className="flex flex-col items-center text-center space-y-4">
                    {/* Number Badge - centered on the line */}
                    <div className="relative z-10 flex items-center justify-center w-20 h-20 bg-primary-teal text-white rounded-full text-2xl font-bold font-poppins shadow-lg">
                      {step.number}
                    </div>
                    
                    <h3 className="text-xl font-semibold font-poppins text-deep-teal">
                      {step.title}
                    </h3>
                    
                    <p className="text-text-dark/70 max-w-xs">
                      {step.description}
                    </p>
                  </div>
                  
                  {/* Arrow between steps (mobile) */}
                  {index < steps.length - 1 && (
                    <div className="md:hidden flex justify-center my-6">
                      <svg className="w-6 h-6 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
