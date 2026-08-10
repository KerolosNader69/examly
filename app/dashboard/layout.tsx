'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, clearUser } from '@/lib/auth';

const navItems = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    href: '/dashboard/exams',
    label: 'My Exams',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    href: '/dashboard/results',
    label: 'Results & Analytics',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUserState] = useState(getUser());
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    clearUser();
    setUserState(null);
    router.push('/');
  };

  const isActive = (href: string) => (href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href));

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-light-mint/10">
        <Link href="/" className="flex items-center">
          <Image
            src="/assets/logo/screen-removebg-preview.png"
            alt="Examly Logo"
            width={120}
            height={48}
            className="object-contain"
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-card text-sm font-medium transition-all duration-200 ${
              isActive(item.href)
                ? 'bg-primary-teal text-white shadow-md'
                : 'text-light-mint/70 hover:bg-white/5 hover:text-light-mint'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
            </svg>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-6 border-t border-light-mint/10">
        {user ? (
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-primary-teal flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {user.name
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-light-mint/60 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              className="text-light-mint/50 hover:text-light-mint transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="block text-center px-4 py-2.5 rounded-card border border-light-mint/30 text-light-mint text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Log In
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-light dark:bg-deep-teal">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-deep-teal z-40">{SidebarContent}</aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-deep-teal/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)}></div>
          <aside className="absolute inset-y-0 left-0 w-72 bg-deep-teal shadow-2xl">
            <button
              className="absolute top-5 right-4 text-light-mint/70 hover:text-white transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile Top Bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-deep-teal px-4 py-3 flex items-center justify-between">
        <Image
          src="/assets/logo/screen-removebg-preview.png"
          alt="Examly Logo"
          width={100}
          height={40}
          className="object-contain"
        />
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 text-light-mint hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
