'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { getExams, deleteExam, Exam } from '@/lib/exams';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import Breadcrumbs from '@/components/dashboard/Breadcrumbs';

const statusMap: Record<Exam['status'], { label: string; color: 'green' | 'teal' | 'gray' }> = {
  published: { label: 'Published', color: 'green' },
  completed: { label: 'Completed', color: 'teal' },
  draft: { label: 'Draft', color: 'gray' },
};

type SortKey = 'title' | 'studentCount' | 'averageScore';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 6;

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  return (
    <svg
      className={`w-3 h-3 transition-colors ${
        sortKey === column ? 'text-primary-teal' : 'text-text-dark/30 dark:text-light-mint/30'
      }`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {sortKey === column && sortDir === 'desc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      )}
    </svg>
  );
}

export default function ExamsList() {
  const [exams, setExams] = useState<Exam[]>(getExams());
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const toast = useToast();

  const filtered = useMemo(() => {
    let list = exams.filter(
      (exam) =>
        exam.title.toLowerCase().includes(query.toLowerCase()) ||
        exam.subject.toLowerCase().includes(query.toLowerCase()) ||
        exam.code.toLowerCase().includes(query.toLowerCase())
    );

    list = [...list].sort((a, b) => {
      let result = 0;
      if (sortKey === 'studentCount') result = a.studentCount - b.studentCount;
      else if (sortKey === 'averageScore') result = a.averageScore - b.averageScore;
      else result = a.title.localeCompare(b.title);
      return sortDir === 'asc' ? result : -result;
    });

    return list;
  }, [exams, query, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleDelete = (id: string) => {
    deleteExam(id);
    setExams(getExams());
    setConfirmDelete(null);
    toast('Exam deleted', 'success');
  };

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold font-poppins text-deep-teal dark:text-white">My Exams</h1>
            <p className="text-text-dark/60 dark:text-light-mint/70 mt-1">Create, manage, and publish your oral assessments.</p>
          </div>
        <Link
          href="/dashboard/exams/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-card bg-primary-teal text-white font-medium hover:bg-light-mint transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Exam
        </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
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
          placeholder="Search by title, subject, or code..."
          className="w-full pl-12 pr-4 py-3 rounded-card border border-gray-200 bg-white text-text-dark outline-none transition-all duration-200 focus:ring-2 focus:ring-primary-teal/30 hover:border-primary-teal/40 dark:bg-dark-surface dark:border-light-mint/15 dark:text-light-mint dark:placeholder:text-light-mint/30"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 bg-bg-light/80 dark:bg-dark-elevated border-b border-gray-100 dark:border-light-mint/10 text-xs font-semibold uppercase tracking-wider text-text-dark/50 dark:text-light-mint/50">
          <button onClick={() => toggleSort('title')} className="flex items-center gap-1 hover:text-primary-teal transition-colors text-left">
            Exam <SortIcon column="title" sortKey={sortKey} sortDir={sortDir} />
          </button>
          <span>Code</span>
          <button onClick={() => toggleSort('studentCount')} className="flex items-center gap-1 hover:text-primary-teal transition-colors text-left">
            Students <SortIcon column="studentCount" sortKey={sortKey} sortDir={sortDir} />
          </button>
          <button onClick={() => toggleSort('averageScore')} className="flex items-center gap-1 hover:text-primary-teal transition-colors text-left">
            Avg. Score <SortIcon column="averageScore" sortKey={sortKey} sortDir={sortDir} />
          </button>
          <span>Status</span>
          <span></span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary-teal/10 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-deep-teal dark:text-white mb-2">No exams found</h3>
            <p className="text-text-dark/50 dark:text-light-mint/50 mb-6">
              {query ? 'Try a different search term.' : 'Create your first oral exam to get started.'}
            </p>
            {!query && (
              <Link
                href="/dashboard/exams/new"
                className="inline-flex px-6 py-3 rounded-card bg-primary-teal text-white font-medium hover:bg-light-mint transition-colors"
              >
                Create an Exam
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 dark:divide-light-mint/10">
              {visible.map((exam) => (
                <div
                  key={exam.id}
                  className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-3 md:gap-4 px-6 py-4 hover:bg-bg-light/50 dark:hover:bg-dark-elevated transition-colors"
                >
                  <Link href={`/dashboard/exams/${exam.id}`} className="min-w-0">
                    <p className="font-semibold text-deep-teal dark:text-light-mint hover:text-primary-teal transition-colors truncate">{exam.title}</p>
                    <p className="text-sm text-text-dark/50 dark:text-light-mint/50">{exam.subject}</p>
                  </Link>
                  <div className="md:flex items-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-bg-light dark:bg-dark-elevated border border-primary-teal/20 text-sm font-mono text-primary-teal">
                      {exam.code}
                    </span>
                  </div>
                  <div className="md:flex items-center text-sm text-text-dark/70 dark:text-light-mint/70">{exam.studentCount}</div>
                  <div className="md:flex items-center text-sm text-text-dark/70 dark:text-light-mint/70">
                    {exam.averageScore > 0 ? `${exam.averageScore}%` : '—'}
                  </div>
                  <div className="md:flex items-center">
                    <Badge color={statusMap[exam.status].color}>{statusMap[exam.status].label}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/dashboard/exams/${exam.id}`}
                      className="p-2 text-text-dark/40 dark:text-light-mint/40 hover:text-primary-teal transition-colors"
                      title="View exam"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Link>
                    {confirmDelete === exam.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(exam.id)}
                          className="px-2.5 py-1 rounded bg-error text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2.5 py-1 rounded bg-gray-100 dark:bg-dark-elevated text-text-dark dark:text-light-mint text-xs font-semibold hover:bg-gray-200 dark:hover:bg-light-mint/10 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(exam.id)}
                        className="p-2 text-text-dark/40 dark:text-light-mint/40 hover:text-error transition-colors"
                        title="Delete exam"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 border-t border-gray-100 dark:border-light-mint/10">
              <Pagination page={safePage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
