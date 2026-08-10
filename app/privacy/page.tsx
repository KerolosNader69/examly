import React from 'react';
import Link from 'next/link';
import LegalLayout from '@/components/layout/LegalLayout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Examly',
  description: 'How Examly collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 10, 2026">
      <h2>1. Information We Collect</h2>
      <p>
        We collect information you provide directly to us, including your name, email address, and any content you submit
        through the platform such as exam questions and audio responses.
      </p>

      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, maintain, and improve our services</li>
        <li>Process and grade oral exam responses using our AI models</li>
        <li>Send you important account and service notifications</li>
        <li>Respond to your comments, questions, and support requests</li>
      </ul>

      <h2>3. Audio Data &amp; AI Grading</h2>
      <p>
        Audio recordings of student responses are processed by our AI grading engine to evaluate pronunciation,
        vocabulary, fluency, and grammar. Recordings are encrypted in transit and at rest, and are only accessible to the
        teacher who created the exam and the student who submitted the response.
      </p>

      <h2>4. Data Sharing</h2>
      <p>
        We do not sell your personal information. We may share data with service providers who assist us in operating the
        platform, and we may disclose information when required by law or to protect the rights and safety of our users.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain exam data and recordings for as long as your account is active, or as needed to provide you services.
        You may request deletion of your data at any time by contacting us.
      </p>

      <h2>6. Children&apos;s Privacy</h2>
      <p>
        Examly is used by educational institutions. We process student data solely at the direction of the institution
        and in accordance with applicable laws. If you are a parent or guardian with concerns about your child&apos;s data,
        please contact the institution or us directly.
      </p>

      <h2>7. Your Rights</h2>
      <p>
        Depending on your location, you may have the right to access, correct, or delete your personal information, and to
        object to or restrict certain processing. To exercise these rights, contact us at{' '}
        <Link href="mailto:privacy@examly.ai">privacy@examly.ai</Link>.
      </p>

      <h2>8. Contact Us</h2>
      <p>
        If you have any questions about this Privacy Policy, please contact us at{' '}
        <Link href="mailto:privacy@examly.ai">privacy@examly.ai</Link>.
      </p>
    </LegalLayout>
  );
}
