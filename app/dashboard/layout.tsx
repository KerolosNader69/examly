'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, clearUser, setUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface NotificationItem {
  id: string;
  title: string;
  category: string;
  time: string;
  unread: boolean;
  type: 'exam' | 'student' | 'billing' | 'grading' | 'system';
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return 'Recently';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'Just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

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
    href: '/dashboard/exams/new',
    label: 'Create Exam',
    icon: 'M12 4v16m8-8H4',
  },
  {
    href: '/dashboard/results',
    label: 'Recordings',
    icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  },
  {
    href: '/dashboard/billing',
    label: 'Billing',
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  // Notification dropdown state
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  // Hydrate user from Supabase Auth & teachers table
  const [user, setUserState] = useState<{ name: string; email: string; role: 'teacher' | 'student' } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndLoadUser() {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();

        if (error || !authUser) {
          // Fallback check to localStorage if offline/simulated
          const localUser = getUser();
          if (localUser && isMounted) {
            setUserState(localUser);
            setLoadingUser(false);
            return;
          }

          // Unauthenticated -> redirect to /login
          if (isMounted) {
            router.push('/login');
          }
          return;
        }

        // Require verified email address for dashboard access
        const isConfirmed = Boolean(authUser.email_confirmed_at || (authUser as any).confirmed_at);
        if (!isConfirmed) {
          clearUser();
          if (isMounted) {
            router.push(`/verify-email?email=${encodeURIComponent(authUser.email || '')}`);
          }
          return;
        }

        // Query real teacher data from Supabase 'teachers' table
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('name, email, plan')
          .eq('id', authUser.id)
          .single();

        const name = teacherData?.name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Teacher';
        const email = authUser.email || '';
        const plan = teacherData?.plan || 'free';

        if (isMounted) {
          const userObj: { name: string; email: string; role: 'teacher' | 'student' } = { name, email, role: 'teacher' };
          setUserState(userObj);
          setUser(userObj);
        }

        // Query real events for this teacher
        const { data: examsData } = await supabase
          .from('exams')
          .select('id, title, status, start_time, end_time, created_at, ai_insights_summary')
          .eq('teacher_id', authUser.id);

        const teacherExams = examsData || [];
        const examIds = teacherExams.map((e) => e.id);

        let studentSessions: any[] = [];
        if (examIds.length > 0) {
          const { data: sessData } = await supabase
            .from('student_sessions')
            .select('id, exam_id, student_name, started_at, completed_at, status')
            .in('exam_id', examIds)
            .order('started_at', { ascending: false })
            .limit(20);
          if (sessData) {
            studentSessions = sessData;
          }
        }

        // Retrieve read notification IDs from localStorage
        const storedRead = typeof window !== 'undefined' ? localStorage.getItem(`read_notifs_${email}`) : null;
        const readIds = new Set<string>(storedRead ? JSON.parse(storedRead) : []);

        const realNotifs: (NotificationItem & { rawTime: number })[] = [];
        const examMap = new Map(teacherExams.map((e) => [e.id, e]));
        const now = new Date();

        // 1. Closed Exams
        teacherExams.forEach((exam) => {
          const isExpired = exam.status === 'published' && exam.end_time && new Date(exam.end_time) <= now;
          const isClosed = exam.status === 'completed' || exam.status === 'closed' || isExpired;

          if (isClosed) {
            const examSess = studentSessions.filter((s) => s.exam_id === exam.id);
            const completedCount = examSess.filter((s) => s.status === 'completed' || s.completed_at).length;
            const totalCount = examSess.length;

            const notifId = `exam-closed-${exam.id}`;
            const detailStr = totalCount > 0 ? ` — ${completedCount}/${totalCount} students completed` : '';

            realNotifs.push({
              id: notifId,
              title: `Exam '${exam.title}' has closed${detailStr}`,
              category: 'Exam Update',
              time: timeAgo(exam.end_time || exam.created_at),
              unread: !readIds.has(notifId),
              type: 'exam',
              rawTime: new Date(exam.end_time || exam.created_at).getTime(),
            });
          }
        });

        // 2. Student Activity (Student Joined)
        studentSessions.forEach((sess) => {
          const exam = examMap.get(sess.exam_id);
          const examTitle = exam ? exam.title : 'Exam';
          const notifId = `student-join-${sess.id}`;

          realNotifs.push({
            id: notifId,
            title: `New student '${sess.student_name}' joined '${examTitle}'`,
            category: 'Student Activity',
            time: timeAgo(sess.started_at),
            unread: !readIds.has(notifId),
            type: 'student',
            rawTime: new Date(sess.started_at).getTime(),
          });
        });

        // 3. AI Insights / Grading Ready
        teacherExams.forEach((exam) => {
          if (exam.ai_insights_summary && Object.keys(exam.ai_insights_summary).length > 0) {
            const notifId = `grading-ready-${exam.id}`;
            realNotifs.push({
              id: notifId,
              title: `AI Grading & Insights ready for '${exam.title}'`,
              category: 'Grading Ready',
              time: timeAgo(exam.created_at),
              unread: !readIds.has(notifId),
              type: 'grading',
              rawTime: new Date(exam.created_at).getTime(),
            });
          }
        });

        // 4. Billing (only show if teacher plan is NOT 'free')
        if (plan && plan.toLowerCase() !== 'free') {
          const notifId = `billing-${authUser.id}-${plan}`;
          realNotifs.push({
            id: notifId,
            title: `Your ${plan.toUpperCase()} plan is currently active`,
            category: 'Billing',
            time: 'Active',
            unread: !readIds.has(notifId),
            type: 'billing',
            rawTime: Date.now(),
          });
        }

        // Sort newest first
        realNotifs.sort((a, b) => b.rawTime - a.rawTime);

        if (isMounted) {
          setNotifications(realNotifs);
        }
      } catch (err) {
        console.error('Error fetching dashboard user / notifications:', err);
        if (isMounted) {
          router.push('/login');
        }
      } finally {
        if (isMounted) {
          setLoadingUser(false);
        }
      }
    }

    checkAuthAndLoadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Click outside to close notifications dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationsOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearUser();
    setUserState(null);
    router.push('/login');
  };

  const markAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, unread: false }));
      if (user?.email && typeof window !== 'undefined') {
        const readIds = updated.map((n) => n.id);
        localStorage.setItem(`read_notifs_${user.email}`, JSON.stringify(readIds));
      }
      return updated;
    });
  };

  const markItemAsRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, unread: false } : n));
      if (user?.email && typeof window !== 'undefined') {
        const readIds = updated.filter((n) => !n.unread).map((n) => n.id);
        localStorage.setItem(`read_notifs_${user.email}`, JSON.stringify(readIds));
      }
      return updated;
    });
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const isActive = (href: string) => (href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href));

  const SidebarContent = (
    <div className="flex flex-col h-full bg-deep-teal">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-light-mint/10 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/assets/logo/ChatGPT Image Aug 11, 2026, 03_55_47 AM.png"
            alt="Examly Logo"
            width={130}
            height={50}
            className="object-contain"
            priority
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-card text-sm font-medium transition-all duration-200 relative ${
                active
                  ? 'bg-primary-teal/20 text-white border-l-4 border-primary-teal font-semibold'
                  : 'text-light-mint/70 hover:bg-white/5 hover:text-light-mint border-l-4 border-transparent'
              }`}
            >
              <svg className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary-teal' : 'text-light-mint/70'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-5 border-t border-light-mint/10">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-teal flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-md">
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
              className="text-light-mint/50 hover:text-light-mint transition-colors p-1"
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

  if (loadingUser && !user) {
    return (
      <div className="min-h-screen bg-deep-teal flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-teal/30 border-t-primary-teal rounded-full animate-spin"></div>
          <p className="text-light-mint text-sm font-medium">Loading teacher dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-light dark:bg-deep-teal">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-deep-teal z-40 shadow-xl">{SidebarContent}</aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-deep-teal/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)}></div>
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

      {/* Main Wrapper */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-light-mint/10 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-deep-teal dark:text-light-mint hover:bg-gray-100 dark:hover:bg-dark-elevated rounded-card transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-text-dark/50 dark:text-light-mint/50">
              <span className="font-semibold text-deep-teal dark:text-light-mint">Teacher Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Bell with Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={`relative p-2.5 rounded-full transition-colors ${
                  notificationsOpen
                    ? 'bg-primary-teal/15 text-primary-teal'
                    : 'text-text-dark/60 dark:text-light-mint/70 hover:bg-gray-100 dark:hover:bg-dark-elevated'
                }`}
                title="Notifications"
                aria-expanded={notificationsOpen}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 01-6 0v-1m6 0H9" />
                </svg>

                {/* Unread badge / dot */}
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-primary-teal ring-2 ring-white dark:ring-dark-surface animate-pulse" />
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-dark-surface rounded-card-lg shadow-2xl border border-gray-200 dark:border-white/10 z-50 overflow-hidden animate-fadeIn">
                  {/* Header */}
                  <div className="p-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold font-poppins text-deep-teal dark:text-white">
                        Notifications
                      </h3>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-primary-teal/15 text-primary-teal">
                          {unreadCount} new
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs font-semibold text-primary-teal hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={clearAllNotifications}
                          className="text-xs text-text-dark/40 dark:text-light-mint/40 hover:text-rose-500 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* List Content */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
                    {notifications.length > 0 ? (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => markItemAsRead(item.id)}
                          className={`p-4 flex items-start gap-3 cursor-pointer transition-colors ${
                            item.unread
                              ? 'bg-primary-teal/5 dark:bg-primary-teal/10 hover:bg-primary-teal/10'
                              : 'hover:bg-gray-50 dark:hover:bg-white/5'
                          }`}
                        >
                          {/* Unread indicator / Icon */}
                          <div className="mt-1 flex-shrink-0">
                            {item.unread ? (
                              <span className="block w-2.5 h-2.5 rounded-full bg-primary-teal shadow-sm" />
                            ) : (
                              <span className="block w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-white/20" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-primary-teal uppercase tracking-wider">
                                {item.category}
                              </span>
                              <span className="text-[11px] text-text-dark/40 dark:text-light-mint/50 flex-shrink-0">
                                {item.time}
                              </span>
                            </div>
                            <p
                              className={`text-xs leading-snug font-inter ${
                                item.unread
                                  ? 'font-semibold text-deep-teal dark:text-white'
                                  : 'text-text-dark/70 dark:text-light-mint/70'
                              }`}
                            >
                              {item.title}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      /* Empty State */
                      <div className="p-8 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-primary-teal/10 text-primary-teal flex items-center justify-center mx-auto">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold font-poppins text-deep-teal dark:text-white">
                            You&apos;re all caught up!
                          </p>
                          <p className="text-xs text-text-dark/50 dark:text-light-mint/50 mt-1">
                            No unread notifications at the moment.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Link */}
                  {notifications.length > 0 && (
                    <div className="p-3 text-center border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
                      <button
                        onClick={markAllAsRead}
                        className="text-xs font-semibold text-text-dark/60 dark:text-light-mint/70 hover:text-primary-teal transition-colors"
                      >
                        Dismiss all unread
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Create Exam CTA */}
            <Link
              href="/dashboard/exams/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-card bg-primary-teal text-white text-sm font-semibold hover:bg-light-mint transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Exam</span>
            </Link>

            {/* User Avatar */}
            {user && (
              <div className="flex items-center gap-2.5 pl-2 border-l border-gray-200 dark:border-light-mint/15">
                <div className="w-9 h-9 rounded-full bg-deep-teal text-white flex items-center justify-center text-xs font-bold shadow-inner">
                  {user.name
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <span className="hidden md:inline-block text-sm font-medium text-deep-teal dark:text-light-mint truncate max-w-[120px]">
                  {user.name}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
