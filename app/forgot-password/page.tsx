import React from 'react';
import type { Metadata } from 'next';
import ForgotPasswordContent from '@/components/auth/ForgotPasswordContent';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Reset your Examly account password.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: '/forgot-password',
  },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordContent />;
}
