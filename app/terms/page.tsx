import React from 'react';
import Link from 'next/link';
import LegalLayout from '@/components/layout/LegalLayout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - Examly',
  description: 'The terms that govern your use of Examly.',
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="August 10, 2026">
      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using Examly, you agree to be bound by these Terms of Service. If you do not agree to these
        terms, please do not use the service.
      </p>

      <h2>2. Your Account</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials and for all activities that
        occur under your account. You agree to provide accurate and complete information when creating an account.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service for any unlawful purpose</li>
        <li>Attempt to interfere with, disrupt, or compromise the integrity of the platform</li>
        <li>Circumvent exam integrity protections or impersonate other users</li>
        <li>Share exam access codes outside of your institution without authorization</li>
        <li>Reverse engineer, decompile, or attempt to extract the source code of the service</li>
      </ul>

      <h2>4. Intellectual Property</h2>
      <p>
        Examly and its original content, features, and functionality are owned by Examly and are protected by
        international copyright, trademark, patent, trade secret, and other intellectual property laws.
      </p>

      <h2>5. Free Plan &amp; Paid Plans</h2>
      <p>
        We offer a free plan and paid subscription plans. We may modify, suspend, or discontinue any plan at any time.
        Paid subscriptions may be cancelled at any time, and access continues until the end of the current billing
        period.
      </p>

      <h2>6. Termination</h2>
      <p>
        We may terminate or suspend your account immediately, without prior notice or liability, for any reason,
        including if you breach these Terms.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        In no event shall Examly be liable for any indirect, incidental, special, consequential, or punitive damages,
        including loss of profits, data, or goodwill, arising out of or in connection with your use of the service.
      </p>

      <h2>8. Changes to Terms</h2>
      <p>
        We reserve the right to modify these Terms at any time. We will provide notice of material changes by updating
        the date at the top of this page. Continued use of the service after changes constitutes acceptance.
      </p>

      <h2>9. Contact</h2>
      <p>
        For questions about these Terms, contact us at <Link href="mailto:legal@examly.ai">legal@examly.ai</Link>.
      </p>
    </LegalLayout>
  );
}
