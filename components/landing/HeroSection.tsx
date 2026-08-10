import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Button from '../ui/Button';

export default function HeroSection() {
  return (
    <section className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 hero-pattern overflow-hidden">
      {/* Sparkle decorations */}
      <div className="absolute top-20 right-1/4 w-6 h-6 sparkle-1 pointer-events-none">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="#F5B62E"/>
        </svg>
      </div>
      <div className="absolute top-40 left-1/4 w-4 h-4 sparkle-2 pointer-events-none">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="#F5B62E"/>
        </svg>
      </div>
      <div className="absolute bottom-32 right-1/3 w-5 h-5 sparkle-3 pointer-events-none hidden md:block">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="#F5B62E"/>
        </svg>
      </div>

      <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
        {/* Left: Text Content */}
        <div className="space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-light-mint/20 border border-primary-teal/30 mb-4">
            <svg className="w-4 h-4 text-primary-teal" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
            <span className="text-sm font-medium text-primary-teal">Now with Advanced AI Grading</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-poppins leading-tight">
            <span className="gradient-text">AI-Powered</span>{' '}
            <span className="text-deep-teal dark:text-white">Oral Exams for Every Teacher</span>
          </h1>
          <p className="text-lg md:text-xl text-text-dark/80 dark:text-light-mint/80">
            Transform your assessment process with intelligent oral examinations. 
            Secure, efficient, and accessible—designed for modern educators.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href="/signup">
              <Button variant="primary" className="text-lg px-8 py-4 w-full sm:w-auto">
                Get Started Free
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="secondary" className="text-lg px-8 py-4 w-full sm:w-auto">
                See Pricing
              </Button>
            </Link>
          </div>
        </div>

        {/* Right: Mascot Illustration with Floating Cards */}
        <div className="flex justify-center md:justify-end">
          <div className="relative w-full max-w-md">
            {/* Soft glow behind mascot */}
            <div className="absolute inset-0 bg-primary-teal/20 rounded-full blur-3xl scale-110 -z-10"></div>
            
            {/* Live Analysis Card - Top Left */}
            <div className="absolute top-10 -left-10 bg-white dark:bg-dark-surface border border-primary-teal/20 shadow-lg rounded-card-lg p-4 flex items-center gap-3 animate-[float_4s_ease-in-out_infinite_reverse] z-20">
              <div className="w-8 h-8 rounded bg-primary-teal/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-deep-teal dark:text-light-mint">Live Analysis</p>
                <div className="flex items-end h-4 mt-1 gap-0.5">
                  <div className="w-1 bg-light-mint rounded-t animate-pulse" style={{ height: '8px', animationDuration: '1s' }}></div>
                  <div className="w-1 bg-light-mint rounded-t animate-pulse" style={{ height: '16px', animationDuration: '1s', animationDelay: '0.2s' }}></div>
                  <div className="w-1 bg-light-mint rounded-t animate-pulse" style={{ height: '12px', animationDuration: '1s', animationDelay: '0.1s' }}></div>
                  <div className="w-1 bg-light-mint rounded-t animate-pulse" style={{ height: '20px', animationDuration: '1s', animationDelay: '0.3s' }}></div>
                  <div className="w-1 bg-light-mint rounded-t animate-pulse" style={{ height: '8px', animationDuration: '1s', animationDelay: '0.05s' }}></div>
                </div>
              </div>
            </div>

            {/* Grading Complete Card - Bottom Right */}
            <div className="absolute bottom-10 -right-4 bg-white dark:bg-dark-surface border border-primary-teal/20 shadow-lg rounded-card-lg p-4 animate-[float_5s_ease-in-out_infinite] z-20">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-primary-teal" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span className="text-xs font-medium text-deep-teal dark:text-light-mint">Grading Complete</span>
              </div>
              <p className="text-2xl font-bold font-poppins text-primary-teal">94/100</p>
            </div>

            {/* Mascot Image */}
            <Image 
              src="/assets/mascot/ChatGPT_Image_Aug_10__2026__03_55_30_AM-removebg-preview.png"
              alt="Examly Mascot"
              width={500}
              height={500}
              className="object-contain relative z-10"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
