'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Button from '../ui/Button';
import ThemeToggle from '../ui/ThemeToggle';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-sm shadow-md dark:bg-deep-teal/95'
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/assets/logo/screen-removebg-preview.png"
              alt="Examly Logo"
              width={120}
              height={50}
              className="object-contain dark:hidden"
              priority
            />
            <Image
              src="/assets/logo/ChatGPT Image Aug 11, 2026, 03_55_47 AM.png"
              alt="Examly Logo"
              width={120}
              height={50}
              className="object-contain hidden dark:block"
              priority
            />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/#features" className="text-text-dark hover:text-primary-teal transition-colors font-medium dark:text-light-mint dark:hover:text-primary-teal">
              Features
            </Link>
            <Link href="/#how-it-works" className="text-text-dark hover:text-primary-teal transition-colors font-medium dark:text-light-mint dark:hover:text-primary-teal">
              How It Works
            </Link>
            <Link href="/pricing" className="text-text-dark hover:text-primary-teal transition-colors font-medium dark:text-light-mint dark:hover:text-primary-teal">
              Pricing
            </Link>
            <Link href="/about" className="text-text-dark hover:text-primary-teal transition-colors font-medium dark:text-light-mint dark:hover:text-primary-teal">
              About
            </Link>
            <Link href="/login" className="text-text-dark hover:text-primary-teal transition-colors font-medium dark:text-light-mint dark:hover:text-primary-teal">
              Login
            </Link>
            <ThemeToggle />
            <Link href="/signup" className="ml-2">
              <Button variant="primary">Sign Up</Button>
            </Link>
          </nav>

          {/* Mobile right controls */}
          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            {/* Mobile menu button */}
            <button
              className="p-2 text-deep-teal dark:text-light-mint"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-sm shadow-lg border-t border-gray-100 dark:bg-deep-teal/95 dark:border-light-mint/10">
          <div className="container mx-auto px-4 py-4 space-y-1">
            {[
              { href: '/#features', label: 'Features' },
              { href: '/#how-it-works', label: 'How It Works' },
              { href: '/pricing', label: 'Pricing' },
              { href: '/about', label: 'About' },
              { href: '/login', label: 'Login' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-card text-text-dark font-medium hover:bg-primary-teal/5 hover:text-primary-teal transition-colors dark:text-light-mint"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/signup" onClick={() => setMobileOpen(false)} className="block px-4 py-3">
              <Button variant="primary" className="w-full">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
