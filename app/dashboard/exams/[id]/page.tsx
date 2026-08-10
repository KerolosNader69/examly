'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getExamById, getResults, getExams, saveExams, Exam } from '@/lib/exams';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import Breadcrumbs from '@/components/dashboard/Breadcrumbs';

export default function ExamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const examId = params.id;

  const [exam, setExam] = useState<Exam | null>(() => getExamById(examId) || null);
  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const wasCreated = searchParams.get('created') === '1';

  useEffect(() => {
    if (!exam) router.replace('/dashboard/exams');
  }, [exam, router]);

  if (!exam) return null;

  const results = getResults().filter((r) => r.examId === examId);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/exam/${exam.code}` : `/exam/${exam.code}`;

  const togglePublish = () => {
    const updated: Exam = { ...exam, status: exam.status === 'published' ? 'draft' : 'published' };
    saveExams(getExams().map((e) => (e.id === exam.id ? updated : e)));
    setExam(updated);
    toast(exam.status === 'published' ? 'Exam unpublished' : 'Exam published', 'success');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    toast('Link copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {wasCreated && (
        <div className="flex items-start gap-3 p-4 rounded-card bg-emerald-50 border border-emerald-200 text-emerald-700">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-semibold">Exam created successfully!</p>
            <p className="text-sm mt-0.5">Share the access code with your students to begin.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <Breadcrumbs overrides={[{ href: `/dashboard/exams/${exam.id}`, label: exam.title }]} />
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold font-poppins text-deep-teal dark:text-white">{exam.title}</h1>
            <Badge color={exam.status === 'published' ? 'green' : exam.status === 'completed' ? 'teal' : 'gray'}>
              {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
            </Badge>
          </div>
          <p className="text-text-dark/60 dark:text-light-mint/70 mt-1">
            {exam.subject} · {exam.questions.length} questions · Created{' '}
            {new Date(exam.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowShare(!showShare)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-card bg-deep-teal text-white font-medium hover:bg-deep-teal/90 transition-all duration-200 shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
          <button
            onClick={togglePublish}
            className={`inline-flex items-center gap-2 px-5 py-3 rounded-card font-medium transition-all duration-200 border-2 ${
              exam.status === 'published'
                ? 'border-primary-teal text-primary-teal hover:bg-primary-teal/5'
                : 'bg-primary-teal text-white hover:bg-light-mint shadow-md'
            }`}
          >
            {exam.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
          <Link
            href={`/exam/${exam.code}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-card bg-primary-teal text-white font-medium hover:bg-light-mint transition-all duration-200 shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Preview
          </Link>
        </div>
      </div>

      {exam.description && <p className="text-text-dark/70 dark:text-light-mint/70 max-w-2xl">{exam.description}</p>}

      {/* Share panel */}
      {showShare && (
        <div className="bg-deep-teal text-white rounded-card-lg p-6">
          <h3 className="font-semibold font-poppins mb-3">Share with students</h3>
          <p className="text-light-mint/80 text-sm mb-4">
            Students can join by visiting the link below, or entering the exam code at the join page.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-3 bg-white/10 rounded-card px-4 py-3 border border-light-mint/20">
              <span className="text-sm font-mono text-light-mint">{shareUrl}</span>
            </div>
            <button
              onClick={handleCopy}
              className="px-5 py-3 rounded-card bg-primary-teal text-white font-medium hover:bg-light-mint transition-all duration-200"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-light-mint/70">Exam code:</span>
            <span className="px-3 py-1.5 rounded bg-white/10 border border-light-mint/30 font-mono font-bold text-light-mint tracking-widest">
              {exam.code}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Questions */}
        <div className="lg:col-span-2 space-y-5">
          <h2 className="text-lg font-semibold font-poppins text-deep-teal dark:text-white">Questions</h2>
          {exam.questions.map((question, index) => (
            <div key={question.id} className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-teal text-white text-sm font-bold">
                  {index + 1}
                </span>
                <span className="text-xs font-medium text-text-dark/50 dark:text-light-mint/60">{question.timeLimit} seconds</span>
              </div>
              <p className="text-text-dark dark:text-light-mint font-medium mb-3">{question.text}</p>
              {question.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {question.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="px-2.5 py-1 rounded-full bg-light-mint/20 border border-primary-teal/20 text-xs font-medium text-primary-teal"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Results summary */}
        <div className="space-y-5">
          <h2 className="text-lg font-semibold font-poppins text-deep-teal dark:text-white">Performance</h2>
          <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 rounded-card bg-bg-light dark:bg-dark-elevated">
                <p className="text-3xl font-bold font-poppins text-primary-teal">{exam.studentCount}</p>
                <p className="text-sm text-text-dark/60 dark:text-light-mint/60 mt-1">Students</p>
              </div>
              <div className="p-4 rounded-card bg-bg-light dark:bg-dark-elevated">
                <p className="text-3xl font-bold font-poppins text-primary-teal">
                  {exam.averageScore > 0 ? `${exam.averageScore}%` : '—'}
                </p>
                <p className="text-sm text-text-dark/60 dark:text-light-mint/60 mt-1">Avg. score</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-deep-teal dark:text-white">Recent submissions</h3>
              <Link href="/dashboard/results" className="text-sm text-primary-teal hover:text-deep-teal transition-colors">
                View analytics
              </Link>
            </div>
            {results.length === 0 ? (
              <p className="text-sm text-text-dark/50 dark:text-light-mint/50 text-center py-6">No submissions yet.</p>
            ) : (
              <div className="space-y-3">
                {results.slice(0, 5).map((result) => (
                  <div key={result.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary-teal/10 text-primary-teal flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {result.name
                          .split(' ')
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <span className="truncate text-text-dark/80 dark:text-light-mint/80">{result.name}</span>
                    </div>
                    <span className={`font-semibold ${result.score >= 70 ? 'text-emerald-600' : result.score >= 50 ? 'text-gold-accent' : 'text-error'}`}>
                      {result.score}/100
                    </span>
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
