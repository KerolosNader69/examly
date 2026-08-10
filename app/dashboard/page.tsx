'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getExams, getResults, Exam } from '@/lib/exams';
import Badge from '@/components/ui/Badge';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusMap: Record<Exam['status'], { label: string; color: 'green' | 'teal' | 'gray' }> = {
  published: { label: 'Published', color: 'green' },
  completed: { label: 'Completed', color: 'teal' },
  draft: { label: 'Draft', color: 'gray' },
};

export default function DashboardOverview() {
  const [exams] = useState<Exam[]>(getExams());
  const results = getResults();

  const published = exams.filter((e) => e.status === 'published').length;
  const completed = exams.filter((e) => e.status === 'completed').length;
  const drafts = exams.filter((e) => e.status === 'draft').length;
  const totalStudents = exams.reduce((sum, e) => sum + e.studentCount, 0);
  const avgScore = exams.filter((e) => e.averageScore > 0).reduce((sum, e) => sum + e.averageScore, 0) /
    Math.max(1, exams.filter((e) => e.averageScore > 0).length);

  const stats = [
    { label: 'Total Exams', value: exams.length, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'teal' },
    { label: 'Students Assessed', value: totalStudents, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', color: 'gold' },
    { label: 'Avg. Score', value: `${Math.round(avgScore)}%`, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'mint' },
    { label: 'Pending Grading', value: results.filter((r) => r.score === 0).length, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'gray' },
  ];

  const recentExams = exams.slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-poppins text-deep-teal dark:text-white">Dashboard</h1>
          <p className="text-text-dark/60 dark:text-light-mint/70 mt-1">Welcome back! Here&apos;s what&apos;s happening with your exams.</p>
        </div>
        <Link
          href="/dashboard/exams/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-card bg-primary-teal text-white font-medium hover:bg-light-mint transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Exam
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
            <div
              className={`w-11 h-11 rounded-card flex items-center justify-center mb-4 ${
                stat.color === 'teal'
                  ? 'bg-primary-teal/10 text-primary-teal'
                  : stat.color === 'gold'
                  ? 'bg-gold-accent/15 text-gold-accent'
                  : stat.color === 'mint'
                  ? 'bg-light-mint/30 text-primary-teal'
                  : 'bg-gray-100 dark:bg-dark-elevated text-text-dark/50 dark:text-light-mint/50'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={stat.icon} />
              </svg>
            </div>
            <p className="text-3xl font-bold font-poppins text-deep-teal dark:text-white">{stat.value}</p>
            <p className="text-sm text-text-dark/60 dark:text-light-mint/60 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Exams */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold font-poppins text-deep-teal dark:text-white">Recent Exams</h2>
            <Link href="/dashboard/exams" className="text-sm text-primary-teal font-medium hover:text-deep-teal dark:hover:text-light-mint transition-colors">
              View all
            </Link>
          </div>

          {recentExams.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-dark/50 dark:text-light-mint/50 mb-4">No exams yet.</p>
              <Link
                href="/dashboard/exams/new"
                className="inline-flex px-5 py-2.5 rounded-card bg-primary-teal text-white font-medium hover:bg-light-mint transition-colors"
              >
                Create your first exam
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentExams.map((exam) => (
                <Link
                  key={exam.id}
                  href={`/dashboard/exams/${exam.id}`}
                  className="flex items-center justify-between gap-4 p-4 rounded-card border border-gray-100 dark:border-light-mint/10 bg-bg-light/50 dark:bg-dark-elevated/50 hover:border-primary-teal/40 hover:bg-white dark:hover:bg-dark-elevated transition-all duration-200 group"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-deep-teal dark:text-light-mint truncate group-hover:text-primary-teal transition-colors">
                      {exam.title}
                    </p>
                    <p className="text-sm text-text-dark/50 dark:text-light-mint/50 mt-0.5">
                      {exam.subject} · {formatDate(exam.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="hidden sm:inline-block text-sm text-text-dark/50 dark:text-light-mint/50">{exam.studentCount} students</span>
                    <Badge color={statusMap[exam.status].color}>{statusMap[exam.status].label}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions / status card */}
        <div className="space-y-5">
          <div className="bg-deep-teal rounded-card-lg shadow-md p-6 text-white">
            <h3 className="font-semibold font-poppins mb-4">Exam Status</h3>
            <div className="space-y-3">
              {[
                { label: 'Published', value: published, color: 'bg-emerald-400' },
                { label: 'Completed', value: completed, color: 'bg-light-mint' },
                { label: 'Drafts', value: drafts, color: 'bg-white/40' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`}></span>
                    <span className="text-sm text-light-mint/80">{item.label}</span>
                  </div>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-5 border-t border-light-mint/15">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-light-mint/80">Completion rate</span>
                <span className="font-semibold">{completed + published > 0 ? Math.round((completed / (completed + published)) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-white/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-teal rounded-full transition-all duration-500"
                  style={{ width: `${completed + published > 0 ? (completed / (completed + published)) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <Link
            href="/dashboard/exams/new"
            className="block bg-white dark:bg-dark-surface rounded-card-lg border border-dashed border-primary-teal/40 p-6 text-center hover:border-primary-teal hover:bg-primary-teal/5 transition-all duration-200 group"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-primary-teal/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="font-semibold text-deep-teal dark:text-white">New Oral Exam</p>
            <p className="text-sm text-text-dark/50 dark:text-light-mint/50 mt-1">Set up questions and rubric</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
