'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Exam } from '@/lib/exams';
import Badge from '@/components/ui/Badge';
import { getUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type DisplayStatus = 'scheduled' | 'open' | 'closed';

function getDisplayStatus(exam: Exam): { label: string; status: DisplayStatus; color: 'gold' | 'green' | 'gray' } {
  if (exam.status === 'draft') return { label: 'Scheduled', status: 'scheduled', color: 'gold' };
  if (exam.status === 'published') return { label: 'Open', status: 'open', color: 'green' };
  return { label: 'Closed', status: 'closed', color: 'gray' };
}

export default function DashboardOverview() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [user, setUserState] = useState<{ name: string }>({ name: 'Teacher' });

  useEffect(() => {
    let isMounted = true;
    async function loadDashboardData() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          // Fetch teacher name
          const { data: teacherData } = await supabase
            .from('teachers')
            .select('name')
            .eq('id', authUser.id)
            .single();

          if (isMounted && teacherData?.name) {
            setUserState({ name: teacherData.name });
          }

          // Fetch exams & sessions from Supabase
          const { data: dbExams } = await supabase
            .from('exams')
            .select('*, student_sessions(id, ai_score, teacher_override_score)')
            .eq('teacher_id', authUser.id)
            .order('created_at', { ascending: false });

          if (isMounted && dbExams) {
            const mappedExams: Exam[] = dbExams.map((e: any) => {
              const sessions = e.student_sessions || [];
              const studentCount = sessions.length;
              const scores = sessions
                .map((s: any) => s.teacher_override_score ?? s.ai_score)
                .filter((score: any) => score != null);
              const avgScore = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

              return {
                id: e.id,
                title: e.title,
                subject: 'Oral Assessment',
                description: `Created on ${new Date(e.created_at).toLocaleDateString()}`,
                type: e.exam_type || 'audio',
                status: e.status === 'published' ? 'published' : e.status === 'completed' ? 'completed' : 'draft',
                code: e.id,
                studentCount,
                averageScore: Math.round(avgScore),
                createdAt: e.created_at,
                questions: [],
              };
            });

            setExams(mappedExams);
            return;
          }
        }
      } catch (err) {
        console.error('Error loading dashboard overview data:', err);
      }

      // Fallback user state check without mock exams
      const loggedIn = getUser();
      if (loggedIn && isMounted) {
        setUserState(loggedIn);
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const totalExams = exams.length;
  const totalStudents = exams.reduce((sum, e) => sum + e.studentCount, 0);
  const examsWithScores = exams.filter((e) => e.averageScore > 0);
  const avgScore = examsWithScores.length > 0
    ? examsWithScores.reduce((sum, e) => sum + e.averageScore, 0) / examsWithScores.length
    : 0;

  const stats = [
    {
      label: 'Total Exams',
      value: totalExams,
      trend: totalExams > 0 ? `${totalExams} created` : 'No exams created yet',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
    {
      label: 'Average Score',
      value: `${Math.round(avgScore)}%`,
      trend: examsWithScores.length > 0 ? `Across ${examsWithScores.length} exams` : 'No graded submissions',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    },
    {
      label: 'Active Students',
      value: totalStudents,
      trend: totalStudents > 0 ? `${totalStudents} submissions` : '0 submissions',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    },
  ];

  const recentExams = exams.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Greeting Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-poppins text-deep-teal">
            Welcome back, {user.name.split(' ')[0]} 👋
          </h1>
          <p className="text-text-dark/70 mt-1">
            Here&apos;s an overview of your oral assessment activities and student metrics.
          </p>
        </div>
      </div>

      {/* 3 Stat Cards in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-text-dark/60 dark:text-light-mint/60">{stat.label}</span>
              <div className="w-10 h-10 rounded-card bg-primary-teal/10 text-primary-teal flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={stat.icon} />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold font-poppins text-deep-teal dark:text-white">{stat.value}</p>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>{stat.trend}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Exams Table / Empty State */}
      <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-light-mint/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold font-poppins text-deep-teal dark:text-white">Recent Exams</h2>
            <p className="text-xs text-text-dark/50 dark:text-light-mint/50">Manage your active and completed assessments</p>
          </div>
          {recentExams.length > 0 && (
            <Link
              href="/dashboard/exams"
              className="text-sm font-semibold text-primary-teal hover:text-deep-teal dark:hover:text-light-mint transition-colors"
            >
              View all exams &rarr;
            </Link>
          )}
        </div>

        {recentExams.length === 0 ? (
          /* Empty State with Mascot */
          <div className="text-center py-16 px-6">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <Image
                src="/assets/mascot/ChatGPT Image Aug 11, 2026, 03_05_50 AM.png"
                alt="Examly Mascot"
                fill
                className="object-contain"
              />
            </div>
            <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white mb-2">
              No exams created yet
            </h3>
            <p className="text-text-dark/60 dark:text-light-mint/70 max-w-md mx-auto mb-6 text-sm">
              Get started by creating your first AI-graded oral exam for your students.
            </p>
            <Link
              href="/dashboard/exams/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-card bg-primary-teal text-white font-semibold hover:bg-light-mint transition-all duration-200 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create your first exam
            </Link>
          </div>
        ) : (
          /* Recent Exams Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-light/80 dark:bg-dark-elevated text-xs font-semibold uppercase tracking-wider text-text-dark/50 dark:text-light-mint/50 border-b border-gray-100 dark:border-light-mint/10">
                  <th className="px-6 py-4">Exam Name</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date Created</th>
                  <th className="px-6 py-4">Students Completed</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-light-mint/10 text-sm">
                {recentExams.map((exam) => {
                  const statusInfo = getDisplayStatus(exam);
                  return (
                    <tr
                      key={exam.id}
                      className="hover:bg-bg-light/50 dark:hover:bg-dark-elevated/50 transition-colors group"
                    >
                      <td className="px-6 py-4 font-semibold text-deep-teal dark:text-light-mint">
                        <Link href={`/dashboard/exams/${exam.id}`} className="hover:text-primary-teal transition-colors">
                          {exam.title}
                        </Link>
                        <p className="text-xs text-text-dark/40 dark:text-light-mint/40 font-normal">{exam.subject}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-text-dark/70 dark:text-light-mint/70">
                        {formatDate(exam.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-text-dark/70 dark:text-light-mint/70 font-medium">
                        {exam.studentCount} students
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/exams/${exam.id}`}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-primary-teal hover:text-deep-teal dark:hover:text-light-mint transition-colors"
                        >
                          View
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
