import React from 'react';
import type { Metadata } from 'next';
import ContactContent from '@/components/contact/ContactContent';
import { getBreadcrumbSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the Examly team for support, sales inquiries, or institutional plans.',
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', item: '/' },
    { name: 'Contact', item: '/contact' },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <ContactContent />
    </>
  );
}
