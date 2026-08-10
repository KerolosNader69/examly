'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Button from '../ui/Button';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

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
        isScrolled ? 'bg-white/95 backdrop-blur-sm shadow-md' : 'bg-transparent'
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
              className="object-contain"
              priority
            />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="#features" className="text-text-dark hover:text-primary-teal transition-colors font-medium">
              Features
            </Link>
            <Link href="#pricing" className="text-text-dark hover:text-primary-teal transition-colors font-medium">
              Pricing
            </Link>
            <Link href="/login" className="text-text-dark hover:text-primary-teal transition-colors font-medium">
              Login
            </Link>
            <Button variant="primary" className="ml-2">Sign Up</Button>
          </nav>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 text-deep-teal">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
