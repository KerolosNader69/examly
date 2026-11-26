'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Button from '@/components/ui/Button';
import { allFaqs } from '@/lib/faqData';

const categories = ['All', 'General', 'AI Oral Exams', 'AI Grading', 'Teachers', 'Universities', 'Exam Integrity', 'Student Experience'];

export default function FaqHubContent() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    'what-is-examly': true,
    'does-examly-replace-teachers': true,
  });

  const toggleFaq = (id: string) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredFaqs = allFaqs.filter((faq) => {
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <Header />

      <main className="bg-bg-light dark:bg-deep-teal min-h-screen">
        {/* HERO */}
        <section className="bg-deep-teal relative overflow-hidden py-16 md:py-24 text-white">
          <div className="absolute inset-0 hero-pattern opacity-30"></div>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center max-w-3xl">
            <span className="inline-block px-3.5 py-1 rounded-full bg-primary-teal/20 border border-primary-teal/40 text-light-mint text-xs font-semibold mb-4">
              Factual Product Knowledge Base
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold font-poppins mb-4">
              Frequently Asked <span className="gradient-text">Questions</span>
            </h1>
            <p className="text-base sm:text-lg text-light-mint/80 mb-8">
              Find verified answers regarding Examly AI oral exams, speech transcription, evaluation criteria, teacher controls, and integrity features.
            </p>

            {/* Search Input */}
            <div className="relative max-w-xl mx-auto">
              <input
                type="text"
                placeholder="Search questions or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-5 py-3.5 pl-12 rounded-card bg-white dark:bg-dark-surface text-text-dark dark:text-white placeholder-text-dark/40 dark:placeholder-light-mint/40 shadow-lg border border-primary-teal/30 focus:outline-none focus:ring-2 focus:ring-primary-teal text-sm"
              />
              <svg className="w-5 h-5 text-primary-teal absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </section>

        {/* CATEGORY FILTER & ACCORDIONS */}
        <section className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-card text-xs sm:text-sm font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary-teal text-white shadow-md'
                    : 'bg-white dark:bg-dark-surface text-text-dark dark:text-light-mint border border-primary-teal/15 hover:border-primary-teal/40'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* FAQ Accordion List */}
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-dark-surface rounded-card border border-primary-teal/15 p-8">
              <p className="text-text-dark/70 dark:text-light-mint/70 text-sm">
                No questions found matching &quot;{searchQuery}&quot;. Try adjusting your search query or category filter.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFaqs.map((faq) => {
                const isOpen = !!openIds[faq.id];
                return (
                  <div
                    key={faq.id}
                    className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/15 shadow-sm overflow-hidden transition-colors"
                  >
                    <button
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full px-6 py-4 text-left flex justify-between items-center gap-4 focus:outline-none focus:bg-primary-teal/5"
                      aria-expanded={isOpen}
                    >
                      <span className="font-bold text-deep-teal dark:text-white font-poppins text-base sm:text-lg">
                        {faq.question}
                      </span>
                      <span className="w-7 h-7 rounded-full bg-primary-teal/10 text-primary-teal flex items-center justify-center shrink-0 text-lg font-bold">
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 pt-1 text-sm text-text-dark/80 dark:text-light-mint/80 border-t border-gray-100 dark:border-primary-teal/10 leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* STILL HAVE QUESTIONS */}
          <div className="mt-16 text-center bg-white dark:bg-dark-surface p-8 rounded-card-lg border border-primary-teal/20 shadow-sm max-w-2xl mx-auto">
            <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white mb-2">Still Have Questions?</h3>
            <p className="text-xs text-text-dark/70 dark:text-light-mint/70 mb-6">
              Reach out to our support team or explore how to run an AI oral exam for free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contact">
                <Button variant="primary">
                  Contact Support
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="outline">
                  Get Started Free
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
