import React from 'react';
import type { Metadata } from 'next';
import SignupContent from '@/components/auth/SignupContent';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your free Examly teacher account to start building AI-graded oral exams.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: '/signup',
  },
};

export default function SignupPage() {
  return <SignupContent />;
}