import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-bg-light dark:bg-deep-teal flex flex-col lg:flex-row">
      {/* Brand Panel */}
      <div className="lg:w-1/2 bg-deep-teal relative overflow-hidden hidden lg:flex flex-col justify-between p-12">
        <div className="absolute inset-0 hero-pattern opacity-40"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-teal/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 -left-16 w-72 h-72 bg-gold-accent/10 rounded-full blur-3xl"></div>

        <div className="relative z-10">
          <Link href="/" className="flex items-center">
            <Image
              src="/assets/logo/screen-removebg-preview.png"
              alt="Examly Logo"
              width={140}
              height={56}
              className="object-contain"
              priority
            />
          </Link>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold font-poppins text-white leading-tight">
            The future of oral assessments is here.
          </h2>
          <p className="text-light-mint/80 text-lg max-w-md">
            AI-powered oral exams that grade pronunciation, vocabulary, and fluency in real-time — so you can focus on teaching.
          </p>

          <div className="flex items-center gap-4 pt-4">
            <div className="flex -space-x-3">
              {['SJ', 'AH', 'MR'].map((initials, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-primary-teal flex items-center justify-center text-xs font-semibold text-white ring-2 ring-deep-teal"
                >
                  {initials}
                </div>
              ))}
            </div>
            <p className="text-sm text-light-mint/70">
              Trusted by <span className="text-white font-semibold">5,000+</span> educators
            </p>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <Link href="/">
              <Image
                src="/assets/logo/screen-removebg-preview.png"
                alt="Examly Logo"
                width={140}
                height={56}
                className="object-contain"
              />
            </Link>
          </div>

          <h1 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white mb-2">{title}</h1>
          <p className="text-text-dark/60 dark:text-light-mint/70 mb-8">{subtitle}</p>

          {children}
        </div>
      </div>
    </div>
  );
}
