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
    <div className="min-h-screen bg-bg-light dark:bg-dark-surface flex flex-col">
      {/* Wave-top Banner */}
      <div className="relative w-full h-[35vh] sm:h-[40vh] bg-deep-teal overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 hero-pattern opacity-[0.06]"></div>
        
        {/* Gradient Accents */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-teal/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 -left-16 w-72 h-72 bg-gold-accent/10 rounded-full blur-3xl"></div>

        {/* Logo */}
        <div className="relative z-10 container mx-auto px-6 pt-8">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/assets/logo/screen-removebg-preview.png"
              alt="Examly Logo"
              width={140}
              height={56}
              className="object-contain dark:hidden"
              priority
            />
            <Image
              src="/assets/logo/ChatGPT Image Aug 11, 2026, 03_55_47 AM.png"
              alt="Examly Logo"
              width={140}
              height={56}
              className="object-contain hidden dark:block"
              priority
            />
          </Link>
        </div>

        {/* Wave Bottom Edge */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0]">
          <svg
            className="relative block w-full h-[60px] sm:h-[80px]"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
              className="fill-bg-light dark:fill-dark-surface"
            ></path>
          </svg>
        </div>
      </div>

      {/* Form Panel */}
      <div className="flex-1 flex items-start justify-center px-6 sm:px-10 -mt-16 sm:-mt-20 pb-12 relative overflow-hidden">
        {/* Peek-a-boo Mascot - positioned behind card on the bottom-left */}
        <div className="absolute bottom-4 left-[calc(50%-340px)] w-48 h-60 pointer-events-none z-0 hidden lg:block">
          <div className="relative w-full h-full">
            <Image
              src="/assets/mascot/ChatGPT Image Aug 10, 2026, 03_55_36 AM-Photoroom.png"
              alt="Examly Mascot"
              fill
              className="object-contain object-bottom"
              priority
            />
          </div>
        </div>

        <div className="w-full max-w-md bg-white dark:bg-dark-surface rounded-2xl p-8 shadow-xl border border-gray-100 dark:border-light-mint/10 relative z-10">
          <h1 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white mb-2">{title}</h1>
          <p className="text-text-dark/60 dark:text-light-mint/70 mb-8">{subtitle}</p>

          {children}
        </div>
      </div>
    </div>
  );
}
