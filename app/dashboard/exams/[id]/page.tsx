'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Exam, StudentResult } from '@/lib/exams';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import Breadcrumbs from '@/components/dashboard/Breadcrumbs';

import { supabase } from '@/lib/supabase';

function formatDate(iso?: string): string {
  if (!iso) return 'Aug 10, 2026';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getTypeBadge(type?: string) {
  switch (type) {
    case 'video':
      return <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider">Audio + Video</span>;
    case 'mcq':
      return <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider">MCQ</span>;
    case 'essay':
      return <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wider">Essay</span>;
    default:
      return <span className="px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-900/40 text-primary-teal dark:text-light-mint text-xs font-bold uppercase tracking-wider">Audio Only</span>;
  }
}

export default function ExamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const examId = params.id;

  const [exam, setExam] = useState<Exam | null>(null);
  const [realResults, setRealResults] = useState<StudentResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'results' | 'insights'>('preview');
  const [selectedModelIdx, setSelectedModelIdx] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  const wasCreated = searchParams.get('created') === '1';

  useEffect(() => {
    if (!isLoading && !exam) {
      router.replace('/dashboard/exams');
    }
  }, [isLoading, exam, router]);

  const shareUrl = typeof window !== 'undefined' && exam ? `${window.location.origin}/exam/${exam.code}` : exam ? `/exam/${exam.code}` : '';

  useEffect(() => {
    let isMounted = true;
    async function loadExamData() {
      try {
        const { data: dbExam } = await supabase
          .from('exams')
          .select('*, exam_models(*, questions(*))')
          .eq('id', examId)
          .single();

        if (dbExam && isMounted) {
          const now = new Date();
          const isExpired = dbExam.status === 'published' && dbExam.end_time && new Date(dbExam.end_time) <= now;
          const effectiveStatus = isExpired ? 'completed' : dbExam.status;

          if (isExpired) {
            // Background update status & insights generation
            supabase.from('exams').update({ status: 'completed' }).eq('id', dbExam.id);
            fetch('/api/exam/generate-insights', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ examId: dbExam.id }),
            })
              .then((res) => res.json())
              .then((data) => {
                if (data.insights && isMounted) setInsights(data.insights);
              })
              .catch((err) => console.error('Auto-insights error:', err));
          }

          // Query student sessions for real student metrics
          const { data: dbSessions } = await supabase
            .from('student_sessions')
            .select('*')
            .eq('exam_id', dbExam.id);

          const sessList = dbSessions || [];
          const studentCount = sessList.length;
          const scores = sessList
            .map((s: any) => s.teacher_override_score ?? s.ai_score)
            .filter((score: any) => score != null);
          const averageScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;

          const mappedResults: StudentResult[] = sessList.map((s: any) => ({
            id: s.id,
            examId: s.exam_id,
            name: s.student_name,
            score: s.teacher_override_score ?? s.ai_score ?? 0,
            submittedAt: s.completed_at || s.started_at,
          }));

          setRealResults(mappedResults);

          const parseQuestionData = (q: any) => {
            let options: string[] | undefined = undefined;
            let modelAnswer: string = q.model_answer_text || '';
            if (q.model_answer_text && typeof q.model_answer_text === 'string' && q.model_answer_text.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(q.model_answer_text);
                if (Array.isArray(parsed.options)) options = parsed.options;
                if (parsed.explanation) modelAnswer = parsed.explanation;
              } catch {}
            }
            return {
              id: q.id,
              text: q.question_text,
              options,
              modelAnswer,
              timeLimit: 60,
            };
          };

          const questionsList = (dbExam.exam_models || []).flatMap((m: any) =>
            (m.questions || []).map(parseQuestionData)
          );

          setExam({
            id: dbExam.id,
            code: dbExam.id,
            title: dbExam.title,
            type: dbExam.exam_type || 'audio',
            subject: 'Oral Assessment',
            description: `Created on ${new Date(dbExam.created_at).toLocaleDateString()}`,
            status: effectiveStatus === 'published' ? 'published' : effectiveStatus === 'completed' ? 'completed' : 'draft',
            createdAt: dbExam.created_at,
            studentCount,
            averageScore,
            questions: questionsList.length > 0 ? questionsList : [],
            models: dbExam.exam_models?.map((m: any) => ({
              id: m.id,
              name: m.label,
              questions: (m.questions || []).map(parseQuestionData),
            })),
          });

          if (dbExam.ai_insights_summary) {
            try {
              const parsed = typeof dbExam.ai_insights_summary === 'string'
                ? JSON.parse(dbExam.ai_insights_summary)
                : dbExam.ai_insights_summary;
              setInsights(parsed);
            } catch {
              setInsights(dbExam.ai_insights_summary);
            }
          }
        }
      } catch (err) {
        console.error('Error loading exam detail:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadExamData();
    return () => {
      isMounted = false;
    };
  }, [examId]);

  const closeExamNow = async () => {
    if (!exam) return;
    setIsGeneratingInsights(true);
    const { error } = await supabase.from('exams').update({ status: 'completed' }).eq('id', exam.id);
    if (!error) {
      setExam({ ...exam, status: 'completed' });
      toast('Exam closed. Generating AI Insights...', 'info');

      try {
        const res = await fetch('/api/exam/generate-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examId: exam.id }),
        });
        const data = await res.json();
        if (data.insights) {
          setInsights(data.insights);
          toast('AI Insights generated!', 'success');
        }
      } catch (err) {
        console.error('Error generating insights:', err);
      } finally {
        setIsGeneratingInsights(false);
      }
    } else {
      toast(`Error closing exam: ${error.message}`, 'error');
      setIsGeneratingInsights(false);
    }
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
    toast('Shareable link copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-teal border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!exam) return null;

  const results = realResults;

  // Determine model questions to show
  const availableModels = exam.models && exam.models.length > 0
    ? exam.models
    : [{ id: 'model-a', name: 'Model A', questions: exam.questions }];

  const currentModel = availableModels[selectedModelIdx] || availableModels[0];

  return (
    <div className="space-y-8">
      {wasCreated && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-semibold text-base">Exam Created Successfully!</p>
            <p className="text-sm mt-0.5">Your exam is live. Share the access link below with your students to begin.</p>
          </div>
        </div>
      )}

      {/* METADATA HERO CARD */}
      <div className="bg-white dark:bg-dark-surface p-8 rounded-2xl border border-primary-teal/10 shadow-xl space-y-6">
        <Breadcrumbs overrides={[{ href: `/dashboard/exams/${exam.id}`, label: exam.title }]} />

        {/* Title & Primary Badges */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 dark:border-light-mint/10 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white leading-tight">
                {exam.title}
              </h1>
              {getTypeBadge(exam.type)}
              <Badge color={exam.status === 'published' ? 'green' : exam.status === 'completed' ? 'teal' : 'gold'}>
                {exam.status === 'published' ? 'Open' : exam.status === 'completed' ? 'Closed' : 'Scheduled'}
              </Badge>
            </div>
            <p className="text-sm text-text-dark/60 dark:text-light-mint/70">
              {exam.description || 'Professional assessment created with Examly AI.'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href={`/exam/${exam.code}`}
              target="_blank"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint transition-all duration-200 shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Student View Preview
            </Link>
            {exam.status === 'published' && (
              <button
                onClick={closeExamNow}
                className="px-4 py-3 rounded-card bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                Close Exam
              </button>
            )}
          </div>
        </div>

        {/* Metadata Key Statistics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="p-4 rounded-xl bg-bg-light dark:bg-dark-elevated">
            <span className="text-xs text-text-dark/50 dark:text-light-mint/50 block mb-1">Subject</span>
            <span className="font-semibold text-deep-teal dark:text-light-mint">{exam.subject}</span>
          </div>
          <div className="p-4 rounded-xl bg-bg-light dark:bg-dark-elevated">
            <span className="text-xs text-text-dark/50 dark:text-light-mint/50 block mb-1">Exam Code</span>
            <span className="font-mono font-bold text-primary-teal">{exam.code}</span>
          </div>
          <div className="p-4 rounded-xl bg-bg-light dark:bg-dark-elevated">
            <span className="text-xs text-text-dark/50 dark:text-light-mint/50 block mb-1">Created Date</span>
            <span className="font-semibold text-deep-teal dark:text-light-mint">{formatDate(exam.createdAt)}</span>
          </div>
          <div className="p-4 rounded-xl bg-bg-light dark:bg-dark-elevated">
            <span className="text-xs text-text-dark/50 dark:text-light-mint/50 block mb-1">Model Variants</span>
            <span className="font-semibold text-deep-teal dark:text-light-mint">{availableModels.length} Variants</span>
          </div>
        </div>

        {/* Shareable Link Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-deep-teal/5 dark:bg-dark-elevated border border-primary-teal/20">
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <span className="text-xs font-bold text-text-dark/50 dark:text-light-mint/50 uppercase">Shareable Unlisted Link:</span>
            <span className="font-mono text-sm text-primary-teal font-bold truncate">{shareUrl}</span>
          </div>
          <button
            onClick={handleCopy}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-card bg-primary-teal text-white text-xs font-semibold hover:bg-light-mint transition-colors shadow"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-gray-200 dark:border-light-mint/15 gap-6">
        <button
          onClick={() => setActiveTab('preview')}
          className={`pb-3 text-base font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'preview'
              ? 'border-primary-teal text-primary-teal'
              : 'border-transparent text-text-dark/60 dark:text-light-mint/60 hover:text-deep-teal'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exam Preview &amp; Questions
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`pb-3 text-base font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'results'
              ? 'border-primary-teal text-primary-teal'
              : 'border-transparent text-text-dark/60 dark:text-light-mint/60 hover:text-deep-teal'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Student Submissions ({results.length})
        </button>

        <button
          onClick={() => setActiveTab('insights')}
          className={`pb-3 text-base font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'insights'
              ? 'border-primary-teal text-primary-teal'
              : 'border-transparent text-text-dark/60 dark:text-light-mint/60 hover:text-deep-teal'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI Analytics
        </button>
      </div>

      {/* TAB 1: EXAM PREVIEW & QUESTION LIST */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          {/* Model Variant Tabs Header */}
          <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-primary-teal/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold font-poppins text-deep-teal dark:text-white">Question Sets</h3>
                <p className="text-xs text-text-dark/60 dark:text-light-mint/70">Select a model variant to inspect its assigned questions</p>
              </div>
              <span className="text-xs font-semibold text-primary-teal bg-primary-teal/10 px-3 py-1 rounded-full">
                {currentModel.questions.length} Questions in {currentModel.name}
              </span>
            </div>

            <div className="flex border-b border-gray-200 dark:border-light-mint/15 gap-2 overflow-x-auto">
              {availableModels.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModelIdx(idx)}
                  className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    selectedModelIdx === idx
                      ? 'border-primary-teal text-primary-teal bg-primary-teal/5'
                      : 'border-transparent text-text-dark/60 dark:text-light-mint/60 hover:text-deep-teal'
                  }`}
                >
                  {m.name} ({m.questions.length} questions)
                </button>
              ))}
            </div>
          </div>

          {/* Clean Readable Question Cards List */}
          <div className="space-y-5">
            {currentModel.questions.map((q, idx) => (
              <div
                key={q.id || idx}
                className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-light-mint/15 shadow-sm space-y-4 hover:shadow-md transition-shadow"
              >
                {/* Question Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-primary-teal text-white font-bold text-sm flex items-center justify-center shadow">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-text-dark/50 dark:text-light-mint/50 uppercase tracking-wider">
                      Question {idx + 1}
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-bg-light dark:bg-dark-elevated text-text-dark/70 dark:text-light-mint/70 text-xs font-mono font-medium">
                    ⏱ Time Limit: {q.timeLimit || 60}s
                  </span>
                </div>

                {/* Question Text */}
                <p className="text-lg font-semibold font-poppins text-deep-teal dark:text-white leading-relaxed">
                  {q.text}
                </p>

                {/* If MCQ Options exist */}
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="p-3 rounded-xl bg-bg-light/60 dark:bg-dark-elevated/60 border border-gray-100 dark:border-light-mint/10 text-xs font-medium text-text-dark/80 dark:text-light-mint/80 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary-teal/10 text-primary-teal font-bold flex items-center justify-center text-[10px]">
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span>{opt}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Model Answer / Evaluation Criteria Callout */}
                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Model Answer / Evaluation Criteria
                  </div>
                  <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed font-medium">
                    {q.modelAnswer || 'Student response should demonstrate fluency, clear pronunciation, and key subject terminology.'}
                  </p>
                </div>

                {/* Evaluation Keywords */}
                {q.keywords && q.keywords.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-xs text-text-dark/50 dark:text-light-mint/50 font-medium">Evaluation Keywords:</span>
                    {q.keywords.map((kw, kIdx) => (
                      <span key={kIdx} className="px-2.5 py-0.5 rounded-full bg-primary-teal/10 border border-primary-teal/20 text-primary-teal text-xs font-medium">
                        #{kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: RESULTS */}
      {activeTab === 'results' && (
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-primary-teal/10 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-light-mint/10">
            <h2 className="text-lg font-bold font-poppins text-deep-teal dark:text-white">Student Results</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-light/80 dark:bg-dark-elevated text-xs font-semibold uppercase tracking-wider text-text-dark/50 dark:text-light-mint/50 border-b border-gray-100 dark:border-light-mint/10">
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Score</th>
                  <th className="px-6 py-4">Submission Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-light-mint/10 text-sm">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-text-dark/50 dark:text-light-mint/50">
                      No student submissions recorded yet.
                    </td>
                  </tr>
                ) : (
                  results.map((row) => (
                    <tr key={row.id} className="hover:bg-bg-light/50 dark:hover:bg-dark-elevated/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-deep-teal dark:text-light-mint">{row.name}</td>
                      <td className="px-6 py-4 font-bold text-primary-teal">{row.score}%</td>
                      <td className="px-6 py-4 text-xs text-text-dark/60 dark:text-light-mint/60">{formatDate(row.submittedAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <Link href="/dashboard/results" className="text-xs font-bold text-primary-teal hover:underline">
                          View Recording &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AI INSIGHTS */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {isGeneratingInsights ? (
            <div className="bg-white dark:bg-dark-surface p-12 rounded-2xl border border-primary-teal/20 shadow-lg text-center space-y-4">
              <div className="w-12 h-12 border-4 border-primary-teal border-t-transparent rounded-full animate-spin mx-auto"></div>
              <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">Analyzing Class Submissions...</h3>
              <p className="text-sm text-text-dark/60 dark:text-light-mint/70 max-w-md mx-auto">
                Gemini AI is evaluating student transcripts, discovering misconception patterns, and generating your class report.
              </p>
            </div>
          ) : !insights ? (
            <div className="bg-white dark:bg-dark-surface p-12 rounded-2xl border border-primary-teal/20 shadow-md text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-primary-teal/10 text-primary-teal flex items-center justify-center mx-auto text-2xl font-bold">
                💡
              </div>
              <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">
                {exam.status === 'completed' ? 'AI Insights Not Generated Yet' : 'Insights Available Once Exam Closes'}
              </h3>
              <p className="text-sm text-text-dark/60 dark:text-light-mint/70 max-w-md mx-auto">
                {exam.status === 'completed'
                  ? 'Click "Generate Insights" to run class-level AI performance analysis.'
                  : 'AI Insights will automatically summarize student performance, misconceptions, and follow-up needs when the exam closes.'}
              </p>
              {exam.status === 'completed' && (
                <button
                  onClick={closeExamNow}
                  className="px-6 py-2.5 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint transition-colors shadow-md"
                >
                  Generate AI Insights Now
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Hero Banner */}
              <div className="bg-gradient-to-br from-deep-teal to-[#163D3E] text-white p-8 rounded-2xl shadow-xl border border-light-mint/20 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-teal/20 border border-light-mint/40 flex items-center justify-center text-light-mint">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-poppins text-white">AI Class-Level Insights Report</h2>
                    <p className="text-xs text-light-mint/70">Generated using Gemini 2.5 Flash classwide analytics</p>
                  </div>
                </div>
                <p className="text-sm text-light-mint/90 leading-relaxed bg-white/10 p-4 rounded-xl border border-white/10">
                  {insights.summaryText || 'Class performance report compiled successfully.'}
                </p>
              </div>

              {/* Grid: Weakest Question & Students Needing Follow-up */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Weakest Question Card */}
                {insights.weakestQuestion && (
                  <div className="p-6 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-3 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-bold text-sm uppercase tracking-wider">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Primary Area of Difficulty / Misconception
                    </div>
                    <div className="p-4 rounded-xl bg-white dark:bg-dark-surface border border-amber-200/60 dark:border-amber-800/30 space-y-2">
                      <p className="font-bold text-sm text-deep-teal dark:text-white">
                        &quot;{insights.weakestQuestion.questionText}&quot;
                      </p>
                      <p className="text-xs text-text-dark/70 dark:text-light-mint/70 leading-relaxed">
                        {insights.weakestQuestion.issueDescription}
                      </p>
                    </div>
                  </div>
                )}

                {/* Students Needing Follow-up List */}
                <div className="p-6 rounded-2xl bg-white dark:bg-dark-surface border border-primary-teal/20 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-deep-teal dark:text-white text-base flex items-center gap-2">
                      <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Students Needing Follow-up
                    </h3>
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-full border border-rose-200">
                      {insights.studentsNeedingFollowUp?.length || 0} students
                    </span>
                  </div>

                  {(!insights.studentsNeedingFollowUp || insights.studentsNeedingFollowUp.length === 0) ? (
                    <p className="text-xs text-emerald-600 font-semibold p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      🎉 Great news! All students scored above 70% on this assessment.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {insights.studentsNeedingFollowUp.map((st: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-bg-light dark:bg-dark-elevated border border-gray-100 dark:border-light-mint/10 flex items-center justify-between text-xs">
                          <span className="font-bold text-deep-teal dark:text-white">{st.name}</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-200/50">
                            Score: {st.score}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Comparison Note Card */}
              {insights.comparisonNote && (
                <div className="p-5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 space-y-1 text-xs text-blue-900 dark:text-blue-200">
                  <span className="font-bold uppercase tracking-wider block text-blue-800 dark:text-blue-400 mb-1">
                    📊 Previous Assessment Comparison
                  </span>
                  <p className="leading-relaxed">{insights.comparisonNote}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
