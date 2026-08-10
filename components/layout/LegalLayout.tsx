import React from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

interface LegalLayoutProps {
  title: string;
  updated: string;
  children: React.ReactNode;
}

export default function LegalLayout({ title, updated, children }: LegalLayoutProps) {
  return (
    <>
      <Header />
      <main className="bg-white dark:bg-deep-teal">
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold font-poppins text-deep-teal dark:text-white mb-3">{title}</h1>
              <p className="text-sm text-text-dark/50 dark:text-light-mint/50">Last updated: {updated}</p>
            </div>
            <div className="space-y-8 [&_h2]:font-poppins [&_h2]:font-bold [&_h2]:text-deep-teal dark:[&_h2]:text-white [&_h2]:text-xl [&_h2]:mb-3 [&_p]:text-text-dark/75 dark:[&_p]:text-light-mint/75 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_li]:text-text-dark/75 dark:[&_li]:text-light-mint/75 [&_a]:text-primary-teal [&_a:hover]:text-deep-teal dark:[&_a:hover]:text-light-mint">
              {children}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
