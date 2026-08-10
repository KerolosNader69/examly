import React from 'react';
import Link from 'next/link';
import LegalLayout from '@/components/layout/LegalLayout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security - Examly',
  description: 'How Examly protects your data and exam integrity.',
};

export default function SecurityPage() {
  return (
    <LegalLayout title="Security" updated="August 10, 2026">
      <h2>Exam Integrity</h2>
      <p>
        Maintaining academic integrity is at the core of Examly. Our platform includes browser lockdown during exams,
        identity verification, and proctoring features that flag unusual behavior such as leaving the exam window.
      </p>

      <h2>Encryption</h2>
      <p>
        All data transmitted between your browser and our servers is encrypted using TLS 1.3. Audio recordings and
        sensitive exam data are encrypted at rest using AES-256.
      </p>

      <h2>Data Isolation</h2>
      <p>
        Each institution&apos;s data is logically isolated. Teachers can only access their own exams and their students&apos;
        results, and students can only access exams they were invited to via a secure access code.
      </p>

      <h2>Access Controls</h2>
      <p>
        Role-based access controls ensure that teachers, students, and administrators each have the minimum permissions
        needed to perform their tasks. Passwords are hashed using industry-standard algorithms and never stored in plain
        text.
      </p>

      <h2>AI Grading Fairness</h2>
      <p>
        Our grading models are designed to be objective and consistent. We regularly audit our models to identify and
        eliminate sources of bias, and teachers always have final oversight over every grade.
      </p>

      <h2>Vulnerability Reporting</h2>
      <p>
        If you discover a security vulnerability, please report it to us at{' '}
        <Link href="mailto:security@examly.ai">security@examly.ai</Link>. We take all reports seriously and will respond
        promptly.
      </p>

      <h2>Compliance</h2>
      <p>
        We comply with applicable data protection regulations including GDPR, FERPA, and COPPA in the regions where we
        operate. For more details, see our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalLayout>
  );
}
