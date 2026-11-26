import React from 'react';
import type { Metadata } from 'next';
import LoginContent from '@/components/auth/LoginContent';

export const metadata: Metadata = {
  title: 'Log In',
  description: 'Log in to your Examly account to manage oral exams and review student results.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: '/login',
  },
};

export default function LoginPage() {
  return <LoginContent />;
}
