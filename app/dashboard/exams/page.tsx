'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { getExams, saveExams, Exam } from '@/lib/exams';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import Breadcrumbs from '@/components/dashboard/Breadcrumbs';
import { supabase } from '@/lib/supabase';

type FilterStatus = 'all' | 'scheduled' | 'open' | 'closed';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getExamStatus(status: Exam['status']): { label: string; key: 'scheduled' | 'open' | 'closed'; color: 'gold' | 'green' | 'gray' } {
  if (status === 'draft') return { label: 'Scheduled', key: 'scheduled', color: 'gold' };
  if (status === 'published') return { label: 'Open', key: 'open', color: 'green' };
  return { label: 'Closed', key: 'closed', color: 'gray' };
}

function getTypeIcon(type?: string) {
  switch (type) {
    case 'video':
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Audio + Video
        </span>
      );
    case 'mcq':
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          MCQ
        </span>
      );
    case 'essay':
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Essay
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-teal-50 text-primary-teal dark:bg-teal-900/30 dark:text-light-mint font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          Audio Only
        </span>
      );
  }
}

const PAGE_SIZE = 5;

export default function MyExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [page, setPage] = useState(1);
  const toast = useToast();

  useEffect(() => {
    let isMounted = true;
    async function fetchTeacherExams() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let query = supabase
          .from('exams')
          .select('*, student_sessions(id, ai_score, teacher_override_score)')
          .order('created_at', { ascending: false });

        if (user) {
          query = query.eq('teacher_id', user.id);
        }

        const { data: dbExams, error } = await query;

        if (error || !dbExams || dbExams.length === 0) {
          if (isMounted) setExams(getExams());
          return;
        }

        if (isMounted && dbExams) {
          const now = new Date();
          const mappedExams: Exam[] = dbExams.map((e: any) => {
            const isExpired = e.status === 'published' && e.end_time && new Date(e.end_time) <= now;
            const effectiveStatus = isExpired ? 'completed' : e.status;

            if (isExpired) {
              // Trigger background status update & insights generation
              supabase.from('exams').update({ status: 'completed' }).eq('id', e.id);
              fetch('/api/exam/generate-insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examId: e.id }),
              }).catch((err) => console.error('Auto-insights generation error:', err));
            }

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
              status: effectiveStatus === 'published' ? 'published' : effectiveStatus === 'completed' ? 'completed' : 'draft',
              code: e.id,
              studentCount,
              averageScore: Math.round(avgScore),
              createdAt: e.created_at,
              questions: [],
            };
          });

          const localExams = getExams();
          const combined = [...mappedExams, ...localExams.filter((l) => !mappedExams.some((m) => m.id === l.id))];
          setExams(combined);
        }
      } catch (err) {
        console.error('Failed to load teacher exams:', err);
        if (isMounted) setExams(getExams());
      }
    }

    fetchTeacherExams();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchQuery =
        exam.title.toLowerCase().includes(query.toLowerCase()) ||
        exam.subject.toLowerCase().includes(query.toLowerCase()) ||
        exam.code.toLowerCase().includes(query.toLowerCase());

      const statusInfo = getExamStatus(exam.status);
      const matchStatus = statusFilter === 'all' || statusInfo.key === statusFilter;

      return matchQuery && matchStatus;
    });
  }, [exams, query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredExams.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleExams = filteredExams.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const copyExamLink = (code: string) => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/exam/${code}` : `/exam/${code}`;
    navigator.clipboard.writeText(url);
    toast('Exam link copied to clipboard!', 'success');
  };

  const closeExamNow = async (id: string) => {
    const { error } = await supabase.from('exams').update({ status: 'completed' }).eq('id', id);
    if (!error) {
      setExams((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'completed' as const } : e)));
      toast('Exam closed. Generating AI Insights...', 'info');
      
      // Trigger AI insights generation in background
      fetch('/api/exam/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: id }),
      }).catch((err) => console.error('Error generating AI insights:', err));
    } else {
      toast(`Error closing exam: ${error.message}`, 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <Breadcrumbs />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold font-poppins text-deep-teal dark:text-white">My Exams</h1>
            <p className="text-text-dark/60 dark:text-light-mint/70 mt-1">Manage, filter, and track all your student assessments.</p>
          </div>
          <Link
            href="/dashboard/exams/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-card bg-primary-teal text-white font-semibold hover:bg-light-mint transition-all duration-200 shadow-md hover:shadow-lg flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Create New Exam
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-dark-surface p-4 rounded-card-lg border border-primary-teal/10 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dark/40 dark:text-light-mint/40">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by exam name, subject, or code..."
            className="w-full pl-12 pr-4 py-2.5 rounded-card border border-gray-200 bg-bg-light dark:bg-dark-elevated dark:border-light-mint/15 text-text-dark dark:text-light-mint text-sm outline-none focus:ring-2 focus:ring-primary-teal/30"
          />
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs font-medium text-text-dark/60 dark:text-light-mint/60 whitespace-nowrap">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as FilterStatus);
              setPage(1);
            }}
            className="px-4 py-2.5 rounded-card border border-gray-200 bg-bg-light dark:bg-dark-elevated dark:border-light-mint/15 text-sm font-medium text-text-dark dark:text-light-mint outline-none focus:ring-2 focus:ring-primary-teal/30 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Exams Table */}
      <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm overflow-hidden">
        {filteredExams.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary-teal/10 flex items-center justify-center mb-4 text-primary-teal">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold font-poppins text-deep-teal dark:text-white mb-1">
              No exams match your filters
            </h3>
            <p className="text-sm text-text-dark/50 dark:text-light-mint/50 mb-6">
              Try adjusting your search query or status filter criteria.
            </p>
            <button
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
              }}
              className="px-5 py-2.5 rounded-card bg-primary-teal text-white text-sm font-semibold hover:bg-light-mint transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-light/80 dark:bg-dark-elevated text-xs font-semibold uppercase tracking-wider text-text-dark/50 dark:text-light-mint/50 border-b border-gray-100 dark:border-light-mint/10">
                    <th className="px-6 py-4">Exam Name</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Start – End Dates</th>
                    <th className="px-6 py-4">Students Completed</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-light-mint/10 text-sm">
                  {visibleExams.map((exam) => {
                    const statusInfo = getExamStatus(exam.status);
                    const startDate = formatDate(exam.createdAt);
                    const endDate = formatDate(new Date(new Date(exam.createdAt).getTime() + 7 * 86400000).toISOString());
                    const completedText = `${exam.studentCount}/30`;

                    return (
                      <tr key={exam.id} className="hover:bg-bg-light/50 dark:hover:bg-dark-elevated/50 transition-colors">
                        <td className="px-6 py-4">
                          <Link href={`/dashboard/exams/${exam.id}`} className="font-semibold text-deep-teal dark:text-light-mint hover:text-primary-teal transition-colors">
                            {exam.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono text-primary-teal bg-primary-teal/10 px-2 py-0.5 rounded">
                              {exam.code}
                            </span>
                            <span className="text-xs text-text-dark/40 dark:text-light-mint/40">{exam.subject}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">{getTypeIcon(exam.type)}</td>
                        <td className="px-6 py-4">
                          <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-text-dark/70 dark:text-light-mint/70">
                          <div>{startDate}</div>
                          <div className="text-text-dark/40 dark:text-light-mint/40">to {endDate}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-text-dark/80 dark:text-light-mint/80">
                          {completedText}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/dashboard/exams/${exam.id}`}
                              className="px-3 py-1.5 rounded bg-primary-teal/10 text-primary-teal text-xs font-semibold hover:bg-primary-teal hover:text-white transition-colors"
                              title="View details"
                            >
                              View
                            </Link>
                            <button
                              onClick={() => copyExamLink(exam.code)}
                              className="px-3 py-1.5 rounded bg-gray-100 dark:bg-dark-elevated text-text-dark/70 dark:text-light-mint/70 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-light-mint/10 transition-colors"
                              title="Copy exam share link"
                            >
                              Copy Link
                            </button>
                            {statusInfo.key === 'open' && (
                              <button
                                onClick={() => closeExamNow(exam.id)}
                                className="px-3 py-1.5 rounded bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-xs font-semibold hover:bg-red-100 transition-colors"
                                title="Close exam now"
                              >
                                Close Now
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-light-mint/10">
              <Pagination page={safePage} pageCount={pageCount} total={filteredExams.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
