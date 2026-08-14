'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const adminNavItems = [
  {
    href: '/admin',
    label: 'Overview',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    href: '/admin/teachers',
    label: 'Teachers',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    href: '/admin/audit-log',
    label: 'Audit Log',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    href: '/admin/system-health',
    label: 'System Health',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    href: '/admin/financial-reports',
    label: 'Financial Reports',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authChecking, setAuthChecking] = useState(pathname !== '/admin/login');
  const [adminUser, setAdminUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    if (pathname === '/admin/login') {
      setAuthChecking(false);
      return;
    }

    let isMounted = true;
    const verifyAdmin = async () => {
      try {
        const res = await fetch('/api/admin/auth/me');
        if (!res.ok) {
          if (isMounted) router.push('/admin/login');
          return;
        }
        const data = await res.json();
        if (!data.authenticated) {
          if (isMounted) router.push('/admin/login');
          return;
        }
        if (isMounted) {
          setAdminUser(data.user);
          setAuthChecking(false);
        }
      } catch (err) {
        if (isMounted) router.push('/admin/login');
      }
    };

    verifyAdmin();
    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  const handleSignOut = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      router.push('/admin/login');
      router.refresh();
    }
  };

  // If on Admin Login page, render full screen login without admin sidebar/topbar
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-deep-teal flex items-center justify-center font-inter text-white">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 animate-spin text-primary-teal" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs font-mono text-light-mint/70">Verifying Admin Privileges...</span>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  const SidebarContent = (
    <div className="flex flex-col h-full bg-deep-teal font-inter">
      {/* Admin Header */}
      <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-3">
          <Image
            src="/assets/logo/screen-removebg-preview.png"
            alt="Examly Logo"
            width={110}
            height={44}
            className="object-contain"
          />
        </Link>
        <span className="px-2 py-0.5 text-[10px] font-bold font-mono uppercase rounded bg-primary-teal/20 text-light-mint border border-light-mint/20">
          ADMIN
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-[10px] font-bold font-mono uppercase tracking-wider text-light-mint/40">
          Internal Management
        </div>
        {adminNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-card text-xs font-semibold transition-all duration-200 ${
                active
                  ? 'bg-primary-teal/20 text-white border-l-4 border-primary-teal'
                  : 'text-light-mint/70 hover:bg-white/5 hover:text-white border-l-4 border-transparent'
              }`}
            >
              <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary-teal' : 'text-light-mint/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Admin User Footer */}
      <div className="px-4 py-4 border-t border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary-teal text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
            SA
          </div>
          <div className="truncate">
            <p className="font-semibold text-white truncate text-xs">Sys Admin</p>
            <p className="text-[10px] font-mono text-light-mint/60 truncate">{adminUser?.email || 'admin@examly.com'}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          title="Sign out of Admin"
          className="text-light-mint/50 hover:text-white transition-colors p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F6F8] dark:bg-deep-teal font-inter">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 bg-deep-teal z-40 shadow-xl border-r border-white/5">
        {SidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-deep-teal/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)}></div>
          <aside className="absolute inset-y-0 left-0 w-64 bg-deep-teal shadow-2xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="lg:pl-60 flex flex-col min-h-screen">
        {/* Admin Top Bar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-white/10 px-4 sm:px-8 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 text-deep-teal dark:text-light-mint hover:bg-gray-100 rounded"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-text-dark/50 dark:text-light-mint/50">
                Examly Control Center
              </span>
              <span className="text-text-dark/30 dark:text-light-mint/30">/</span>
              <span className="text-xs font-semibold text-deep-teal dark:text-white capitalize">
                {pathname.replace('/admin', '') || 'Overview'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* System Health Quick Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>All Systems Operational</span>
            </div>

            {/* Quick Admin Badge */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-text-dark/60 dark:text-light-mint/70 border-l border-gray-200 dark:border-white/10 pl-3">
              <span>ADMIN_AUTHENTICATED</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
