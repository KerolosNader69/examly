'use client';

import React, { useMemo, useState } from 'react';
import { getExams, getResults, Exam } from '@/lib/exams';
import Pagination from '@/components/ui/Pagination';
import Breadcrumbs from '@/components/dashboard/Breadcrumbs';

const scoreColor = (score: number) =>
  score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : score >= 50 ? 'text-gold-accent' : 'text-error';

const scoreBarColor = (score: number) => (score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-gold-accent' : 'bg-error');

type SortKey = 'name' | 'score' | 'submittedAt';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 5;

export default function ResultsPage() {
  const [exams] = useState<Exam[]>(getExams());
  const [results] = useState(getResults());
  const [filterExam, setFilterExam] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  const scored = results.filter((r) => r.score > 0);
  const average = scored.length
    ? Math.round(scored.reduce((sum, r) => sum + r.score, 0) / scored.length)
    : 0;

  const passing = scored.filter((r) => r.score >= 70).length;
  const passingRate = scored.length ? Math.round((passing / scored.length) * 100) : 0;

  const examById = (id: string) => exams.find((e) => e.id === id);

  const filteredResults = useMemo(() => {
    let list = results.filter((r) => (filterExam === 'all' ? true : r.examId === filterExam));

    list = [...list].sort((a, b) => {
      let result = 0;
      if (sortKey === 'score') result = a.score - b.score;
      else if (sortKey === 'name') result = a.name.localeCompare(b.name);
      else result = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      return sortDir === 'asc' ? result : -result;
    });

    return [...list];
  }, [results, filterExam, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filteredResults.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'submittedAt' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const distribution = [0, 0, 0, 0, 0];
  scored.forEach((r) => {
    const bucket = Math.min(4, Math.floor(r.score / 20));
    distribution[bucket] += 1;
  });

  const scores = exams
    .filter((e) => e.averageScore > 0)
    .map((e) => ({ name: e.title, score: e.averageScore }));

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs />
        <h1 className="text-2xl lg:text-3xl font-bold font-poppins text-deep-teal dark:text-white">Results &amp; Analytics</h1>
        <p className="text-text-dark/60 dark:text-light-mint/70 mt-1">Track student performance across all your exams.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
          <p className="text-3xl font-bold font-poppins text-primary-teal">{scored.length}</p>
          <p className="text-sm text-text-dark/60 dark:text-light-mint/60 mt-1">Submissions graded</p>
        </div>
        <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
          <p className="text-3xl font-bold font-poppins text-primary-teal">{average}%</p>
          <p className="text-sm text-text-dark/60 dark:text-light-mint/60 mt-1">Overall average</p>
        </div>
        <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
          <p className="text-3xl font-bold font-poppins text-emerald-600 dark:text-emerald-400">{passingRate}%</p>
          <p className="text-sm text-text-dark/60 dark:text-light-mint/60 mt-1">Passing rate (70%+)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Results table */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-semibold font-poppins text-deep-teal dark:text-white">Individual Results</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => toggleSort('name')}
                  className={`px-3 py-1.5 rounded-card border text-sm font-medium transition-colors ${
                    sortKey === 'name'
                      ? 'border-primary-teal text-primary-teal bg-primary-teal/10'
                      : 'border-gray-200 dark:border-light-mint/15 text-text-dark/60 dark:text-light-mint/60 hover:border-primary-teal/40'
                  }`}
                >
                  Name {sortKey === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => toggleSort('score')}
                  className={`px-3 py-1.5 rounded-card border text-sm font-medium transition-colors ${
                    sortKey === 'score'
                      ? 'border-primary-teal text-primary-teal bg-primary-teal/10'
                      : 'border-gray-200 dark:border-light-mint/15 text-text-dark/60 dark:text-light-mint/60 hover:border-primary-teal/40'
                  }`}
                >
                  Score {sortKey === 'score' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => toggleSort('submittedAt')}
                  className={`px-3 py-1.5 rounded-card border text-sm font-medium transition-colors ${
                    sortKey === 'submittedAt'
                      ? 'border-primary-teal text-primary-teal bg-primary-teal/10'
                      : 'border-gray-200 dark:border-light-mint/15 text-text-dark/60 dark:text-light-mint/60 hover:border-primary-teal/40'
                  }`}
                >
                  Date {sortKey === 'submittedAt' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>
            <select
              value={filterExam}
              onChange={(e) => {
                setFilterExam(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-card border border-gray-200 bg-white dark:bg-dark-elevated dark:border-light-mint/15 text-sm text-text-dark dark:text-light-mint outline-none focus:ring-2 focus:ring-primary-teal/30"
            >
              <option value="all">All exams</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>

          {filteredResults.length === 0 ? (
            <p className="text-center text-text-dark/50 dark:text-light-mint/50 py-12">
              No results yet. Share your exam link with students to get started.
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {visible.map((result) => {
                  const exam = examById(result.examId);
                  return (
                    <div
                      key={result.id}
                      className="flex items-center gap-4 p-4 rounded-card border border-gray-100 dark:border-light-mint/10 hover:border-primary-teal/30 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary-teal/10 text-primary-teal flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {result.name
                          .split(' ')
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-deep-teal dark:text-light-mint truncate">{result.name}</p>
                        <p className="text-sm text-text-dark/50 dark:text-light-mint/50 truncate">
                          {exam?.title || 'Unknown exam'} ·{' '}
                          {new Date(result.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="hidden sm:block w-24 h-2 bg-bg-light dark:bg-dark-elevated rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${scoreBarColor(result.score)}`}
                            style={{ width: `${result.score}%` }}
                          ></div>
                        </div>
                        <span className={`font-bold ${scoreColor(result.score)}`}>{result.score}/100</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination page={safePage} pageCount={pageCount} total={filteredResults.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          )}
        </div>

        {/* Analytics */}
        <div className="space-y-5">
          {/* Score distribution */}
          <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
            <h3 className="font-semibold font-poppins text-deep-teal dark:text-white mb-5">Score Distribution</h3>
            <div className="space-y-3">
              {['0-20', '21-40', '41-60', '61-80', '81-100'].map((range, i) => {
                const max = Math.max(1, ...distribution);
                return (
                  <div key={range} className="flex items-center gap-3">
                    <span className="w-14 text-xs text-text-dark/50 dark:text-light-mint/50 flex-shrink-0">{range}</span>
                    <div className="flex-1 h-6 bg-bg-light dark:bg-dark-elevated rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${i === 4 ? 'bg-primary-teal' : 'bg-light-mint'}`}
                        style={{ width: `${(distribution[i] / max) * 100}%` }}
                      ></div>
                    </div>
                    <span className="w-5 text-right text-sm font-semibold text-deep-teal dark:text-light-mint">{distribution[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-exam averages */}
          <div className="bg-deep-teal rounded-card-lg shadow-md p-6 text-white">
            <h3 className="font-semibold font-poppins mb-5">Average by Exam</h3>
            {scores.length === 0 ? (
              <p className="text-sm text-light-mint/70">No completed exams yet.</p>
            ) : (
              <div className="space-y-4">
                {scores.map((s) => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-light-mint/90 truncate pr-3">{s.name}</span>
                      <span className="font-semibold">{s.score}%</span>
                    </div>
                    <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-teal rounded-full" style={{ width: `${s.score}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
