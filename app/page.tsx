import React from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import PricingSection from '@/components/landing/PricingSection';
import { getSoftwareApplicationSchema, getWebSiteSchema, getOrganizationSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Examly — AI-Powered Oral Exams for Teachers & Students',
  description:
    'Transform oral assessment with Examly. Create AI-graded speaking exams, automate evaluation, prevent tab switching, and save grading hours for educators.',
  alternates: {
    canonical: '/',
  },
};

export default function LandingPage() {
  const softwareSchema = getSoftwareApplicationSchema();
  const websiteSchema = getWebSiteSchema();
  const orgSchema = getOrganizationSchema();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      <Header />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <PricingSection />
      </main>
      <Footer />
    </>
  );
}
