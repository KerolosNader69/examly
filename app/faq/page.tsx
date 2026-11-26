import React from 'react';
import type { Metadata } from 'next';
import FaqHubContent from '@/components/faq/FaqHubContent';
import { allFaqs } from '@/lib/faqData';
import { getBreadcrumbSchema, getOrganizationSchema, getFAQPageSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions | Examly FAQ Hub',
  description: 'Find factual answers about Examly AI oral exams, speech-to-text transcription, AI evaluation criteria, teacher score overrides, and exam integrity.',
  alternates: {
    canonical: '/faq',
  },
  openGraph: {
    title: 'Frequently Asked Questions | Examly FAQ Hub',
    description: 'Find factual answers about Examly AI oral exams, speech-to-text transcription, AI evaluation criteria, teacher score overrides, and exam integrity.',
    url: 'https://examly.site/faq',
    siteName: 'Examly',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Examly FAQ Hub' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Frequently Asked Questions | Examly FAQ Hub',
    description: 'Find factual answers about Examly AI oral exams, speech-to-text transcription, AI evaluation criteria, teacher score overrides, and exam integrity.',
    images: ['/og-image.png'],
  },
};

export default function FaqPage() {
  const breadcrumbs = getBreadcrumbSchema([
    { name: 'Home', item: '/' },
    { name: 'FAQ', item: '/faq' },
  ]);

  const faqSchema = getFAQPageSchema(
    allFaqs.map((faq) => ({
      question: faq.question,
      answer: faq.answer,
    }))
  );

  const orgSchema = getOrganizationSchema();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />

      <FaqHubContent />
    </>
  );
}
