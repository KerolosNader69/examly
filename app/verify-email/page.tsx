import React from 'react';
import type { Metadata } from 'next';
import VerifyEmailContent from '@/components/auth/VerifyEmailContent';

export const metadata: Metadata = {
  title: 'Verify Email',
  description: 'Verify your email address for your Examly account.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: '/verify-email',
  },
};

export default function VerifyEmailPage() {
  return <VerifyEmailContent />;
}
