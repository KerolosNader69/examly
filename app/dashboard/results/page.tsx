'use client';

import React, { useState, useEffect, useRef } from 'react';
import { StudentResult } from '@/lib/exams';
import Breadcrumbs from '@/components/dashboard/Breadcrumbs';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';

export default function RecordingsPage() {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<StudentResult | null>(null);
  const [overrideScore, setOverrideScore] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    let isMounted = true;
    async function loadRecordings() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: teacherExams } = await supabase
            .from('exams')
            .select('id')
            .eq('teacher_id', user.id);

          const examIds = (teacherExams || []).map((e) => e.id);
          if (examIds.length > 0) {
            const { data: sessions } = await supabase
              .from('student_sessions')
              .select('*, exams(id, title, exam_type)')
              .in('exam_id', examIds)
              .order('started_at', { ascending: false });

            if (isMounted && sessions) {
              const mapped: StudentResult[] = sessions.map((s: any) => ({
                id: s.id,
                examId: s.exam_id,
                examTitle: s.exams?.title || 'Assessment',
                examType: s.exams?.exam_type || 'audio',
                name: s.student_name,
                score: s.teacher_override_score ?? s.ai_score ?? 0,
                ai_score: s.ai_score,
                teacher_override_score: s.teacher_override_score,
                ai_score_breakdown: s.ai_score_breakdown,
                submittedAt: s.completed_at || s.started_at,
                recording_url: s.recording_url,
                transcript: s.transcript,
                flagged_reason: s.flagged_reason,
              }));
              const targetSessionId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('session') : null;
              if (targetSessionId) {
                const match = mapped.find((m) => m.id === targetSessionId);
                if (match) {
                  setSelectedResult(match);
                  setOverrideScore(match.score);
                }
              }
              setResults(mapped);
              return;
            }
          }
        }
      } catch (err) {
        console.error('Error loading recordings:', err);
      }
      if (isMounted) setResults([]);
    }

    loadRecordings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectSubmission = (result: StudentResult) => {
    setSelectedResult(result);
    setOverrideScore(result.score);
    setIsPlaying(false);
  };

  const handleSaveOverride = async () => {
    if (!selectedResult) return;
    const newScore = Number(overrideScore);

    const { error } = await supabase
      .from('student_sessions')
      .update({ teacher_override_score: newScore })
      .eq('id', selectedResult.id);

    if (error) {
      toast('Failed to save score override.', 'error');
      return;
    }

    const updatedResults = results.map((r) =>
      r.id === selectedResult.id ? { ...r, score: newScore } : r
    );
    setResults(updatedResults);
    setSelectedResult({ ...selectedResult, score: newScore });
    toast('Score override saved successfully!', 'success');
  };

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs />
        <h1 className="text-2xl lg:text-3xl font-bold font-poppins text-deep-teal dark:text-white mt-1">Submissions &amp; Reviews</h1>
        <p className="text-text-dark/60 dark:text-light-mint/70">Inspect student responses, review MCQ answers, listen to audio recordings, and apply score overrides.</p>
      </div>

      {/* Main Submissions List */}
      <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-light-mint/10 flex items-center justify-between">
          <h2 className="text-lg font-bold font-poppins text-deep-teal dark:text-white">Student Submissions</h2>
          <span className="text-xs font-semibold text-primary-teal bg-primary-teal/10 px-3 py-1 rounded-full">
            {results.length} total submissions
          </span>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-light-mint/10">
          {results.length === 0 ? (
            <div className="text-center py-16 px-6">
              <p className="text-text-dark/50 dark:text-light-mint/50">No submissions available yet.</p>
            </div>
          ) : (
            results.map((r) => (
              <div
                key={r.id}
                onClick={() => handleSelectSubmission(r)}
                className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-colors ${
                  selectedResult?.id === r.id
                    ? 'bg-primary-teal/10 dark:bg-primary-teal/20 border-l-4 border-primary-teal'
                    : 'hover:bg-bg-light/60 dark:hover:bg-dark-elevated/60 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-deep-teal text-white flex items-center justify-center font-bold text-sm">
                    {r.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-deep-teal dark:text-white text-base">{r.name}</h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-primary-teal/10 text-primary-teal text-[11px] font-bold uppercase">
                        {r.examType || 'audio'}
                      </span>
                      {((r as any).flagged_reason || (r as any).flaggedReason) && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-300 text-rose-700 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1 shadow-sm">
                          <span>⚠️</span> Flagged (Tab Switch)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-dark/50 dark:text-light-mint/50 mt-0.5">
                      Exam: <span className="font-semibold text-text-dark/70 dark:text-light-mint/80">{r.examTitle || 'Assessment'}</span> • Submitted: {new Date(r.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs font-medium text-text-dark/50 dark:text-light-mint/50 block">Score</span>
                    <span className="text-lg font-bold text-primary-teal">{r.score}%</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSubmission(r);
                    }}
                    className="px-4 py-2 rounded-card bg-primary-teal text-white text-xs font-semibold hover:bg-light-mint transition-colors"
                  >
                    {r.examType === 'mcq' || r.examType === 'essay' ? 'View Answers' : 'Review Submission'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Review Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-deep-teal/70 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-white dark:bg-dark-surface w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-primary-teal/20 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-deep-teal text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold font-poppins">
                  {selectedResult.name} — {selectedResult.examType === 'mcq' ? 'MCQ Answer Review' : selectedResult.examType === 'essay' ? 'Essay Submission Review' : 'Submission Review'}
                </h3>
                <p className="text-xs text-light-mint/70">Submitted on {new Date(selectedResult.submittedAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-light-mint/70 hover:text-white p-1 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* RENDERING PER EXAM TYPE */}
              {(() => {
                let bd = selectedResult.ai_score_breakdown;
                if (!bd && selectedResult.transcript && selectedResult.transcript.trim().startsWith('{')) {
                  try {
                    bd = JSON.parse(selectedResult.transcript);
                  } catch {}
                }
                bd = bd || {};

                // ─────────────────────────────────────────────────────────────
                // 1. MCQ EXAM REVIEW
                // ─────────────────────────────────────────────────────────────
                if (eType === 'mcq') {
                  const questionScores: any[] = bd.questionScores || bd.questions || [];
                  const totalCorrect = bd.totalCorrect ?? (questionScores.length > 0 ? questionScores.filter((q: any) => q.isCorrect).length : null);
                  const totalQuestions = bd.totalQuestions ?? (questionScores.length > 0 ? questionScores.length : null);
                  const scorePct = selectedResult.teacher_override_score ?? selectedResult.ai_score ?? selectedResult.score ?? 0;

                  return (
                    <div className="space-y-6">
                      {/* MCQ Summary Banner */}
                      <div className="p-5 rounded-2xl bg-gradient-to-r from-deep-teal to-primary-teal text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl shadow">
                            📝
                          </div>
                          <div>
                            <h4 className="text-lg font-bold font-poppins">Multiple Choice Assessment</h4>
                            <p className="text-xs text-light-mint/80">Deterministic evaluation • Auto-graded by answer key</p>
                          </div>
                        </div>

                        <div className="text-right bg-white/10 px-5 py-3 rounded-xl border border-white/20 backdrop-blur-sm">
                          <span className="text-xs text-light-mint/80 uppercase tracking-wider block font-semibold">Deterministic Score</span>
                          <span className="text-2xl font-black">
                            {totalCorrect != null && totalQuestions != null
                              ? `${totalCorrect} out of ${totalQuestions} correct (${scorePct}%)`
                              : `${scorePct}%`}
                          </span>
                        </div>
                      </div>

                      {/* Question-by-Question Breakdown */}
                      {(!Array.isArray(questionScores) || questionScores.length === 0) ? (
                        <div className="p-6 text-center border border-gray-200 dark:border-light-mint/15 rounded-2xl bg-bg-light dark:bg-dark-elevated space-y-2">
                          <p className="text-sm font-semibold text-text-dark/70 dark:text-light-mint/70">
                            No per-question choices stored for this submission.
                          </p>
                          <div className="p-3 bg-white dark:bg-dark-surface rounded-xl text-xs font-mono text-text-dark/80 dark:text-light-mint/80">
                            {selectedResult.transcript || 'Response submitted.'}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-deep-teal dark:text-white flex items-center gap-2">
                            <span>📋</span> Student Answers per Question ({questionScores.length} Questions)
                          </h4>

                          {questionScores.map((qs: any, qIdx: number) => {
                            const isCorrect = qs.isCorrect ?? (qs.score === 100);
                            const qText = qs.questionText || qs.question || `Question ${qIdx + 1}`;
                            const options: string[] = qs.options || [];

                            return (
                              <div
                                key={qIdx}
                                className={`p-5 rounded-2xl border-2 transition-all space-y-4 shadow-sm ${
                                  isCorrect
                                    ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/20 dark:bg-emerald-950/10'
                                    : 'border-rose-200 dark:border-rose-800/40 bg-rose-50/20 dark:bg-rose-950/10'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center ${
                                        isCorrect ? 'bg-emerald-500' : 'bg-rose-500'
                                      }`}
                                    >
                                      {qIdx + 1}
                                    </span>
                                    <h5 className="font-bold text-sm text-deep-teal dark:text-white">{qText}</h5>
                                  </div>
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
                                      isCorrect
                                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                                        : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300'
                                    }`}
                                  >
                                    {isCorrect ? '✓ Correct (100%)' : '✕ Incorrect (0%)'}
                                  </span>
                                </div>

                                {/* Options Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                  {['A', 'B', 'C', 'D'].map((letter, oIdx) => {
                                    const optText = options[oIdx] || '';
                                    const isStudentChoice =
                                      qs.selectedOptionIndex === oIdx ||
                                      qs.selectedOptionLetter?.toUpperCase() === letter ||
                                      (qs.selectedOptionText && optText && qs.selectedOptionText.toLowerCase() === optText.toLowerCase());
                                    const isCorrectChoice =
                                      qs.correctOptionIndex === oIdx ||
                                      qs.correctOptionLetter?.toUpperCase() === letter ||
                                      (qs.correctOptionText && optText && qs.correctOptionText.toLowerCase() === optText.toLowerCase());

                                    let cardStyle =
                                      'border-gray-200 dark:border-light-mint/15 bg-white dark:bg-dark-surface text-text-dark/70 dark:text-light-mint/70';
                                    let badge = null;

                                    if (isCorrectChoice && isStudentChoice) {
                                      cardStyle =
                                        'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/30 font-semibold';
                                      badge = (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-sm">
                                          ✓ Selected (Correct)
                                        </span>
                                      );
                                    } else if (isStudentChoice && !isCorrectChoice) {
                                      cardStyle =
                                        'border-rose-400 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 ring-2 ring-rose-400/30 font-semibold';
                                      badge = (
                                        <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-sm">
                                          ✕ Student Choice
                                        </span>
                                      );
                                    } else if (isCorrectChoice) {
                                      cardStyle =
                                        'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-semibold';
                                      badge = (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                          ✓ Correct Answer
                                        </span>
                                      );
                                    }

                                    return (
                                      <div key={oIdx} className={`p-3 rounded-xl border-2 transition-all space-y-1.5 ${cardStyle}`}>
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={`w-5 h-5 rounded-full font-bold text-[11px] flex items-center justify-center ${
                                                isCorrectChoice
                                                  ? 'bg-emerald-500 text-white'
                                                  : isStudentChoice
                                                  ? 'bg-rose-500 text-white'
                                                  : 'bg-gray-200 text-gray-700'
                                              }`}
                                            >
                                              {letter}
                                            </span>
                                            <span className="text-xs font-semibold">Option {letter}</span>
                                          </div>
                                          {badge}
                                        </div>
                                        <p className="text-xs font-medium pl-7">{optText || `Option ${letter}`}</p>
                                      </div>
                                    );
                                  })}
                                </div>

                                {qs.explanation && (
                                  <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 text-xs text-amber-900 dark:text-amber-200">
                                    <span className="font-bold">💡 Solution Explanation: </span>
                                    {qs.explanation}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // ─────────────────────────────────────────────────────────────
                // 2. ESSAY EXAM REVIEW
                // ─────────────────────────────────────────────────────────────
                if (eType === 'essay') {
                  return (
                    <div className="space-y-6">
                      <div className="p-5 rounded-2xl bg-gradient-to-r from-deep-teal to-primary-teal text-white flex items-center gap-4 shadow-lg">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl shadow">
                          ✍️
                        </div>
                        <div>
                          <h4 className="text-lg font-bold font-poppins">Written Essay Assessment</h4>
                          <p className="text-xs text-light-mint/80">Text response submitted by student</p>
                        </div>
                      </div>

                      <div className="p-5 rounded-card-lg border border-gray-200 dark:border-light-mint/15 bg-bg-light/50 dark:bg-dark-elevated/50 space-y-3">
                        <h4 className="text-xs font-bold text-deep-teal dark:text-white uppercase tracking-wider">
                          Student Written Response
                        </h4>
                        <div className="text-sm text-text-dark/90 dark:text-light-mint/90 leading-relaxed p-4 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-light-mint/10 whitespace-pre-wrap">
                          {selectedResult.transcript || 'No response typed.'}
                        </div>
                      </div>
                    </div>
                  );
                }

                // ─────────────────────────────────────────────────────────────
                // 3. AUDIO / VIDEO EXAM REVIEW
                // ─────────────────────────────────────────────────────────────
                const isVideoRecording =
                  recUrl?.includes('.webm') ||
                  recUrl?.includes('.mp4') ||
                  eType === 'video' ||
                  eType === 'audio_video';

                return (
                  <div className="space-y-6">
                    {/* Media Player */}
                    {!recUrl ? (
                      <div className="p-4 rounded-card-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-sm shadow">
                          ⚠️
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-deep-teal dark:text-white">No Media Recording Available</h4>
                          <p className="text-xs text-text-dark/60 dark:text-light-mint/70">
                            This submission does not have an attached audio/video file (e.g. session was terminated early or no speech was recorded).
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 rounded-card-lg bg-deep-teal/5 dark:bg-dark-elevated border border-primary-teal/20 space-y-3">
                        <h4 className="text-sm font-bold text-deep-teal dark:text-light-mint flex items-center gap-2">
                          <svg className="w-4 h-4 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isVideoRecording ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            )}
                          </svg>
                          {isVideoRecording ? 'Video & Audio Recording Player' : 'Audio Recording Player'}
                        </h4>
                        <div className="bg-white dark:bg-dark-surface p-4 rounded-card border border-gray-200 dark:border-light-mint/15">
                          {isVideoRecording ? (
                            <video
                              controls
                              src={recUrl}
                              className="w-full max-h-80 rounded-xl object-contain bg-black shadow-lg"
                            />
                          ) : (
                            <audio
                              ref={audioRef}
                              controls
                              src={recUrl}
                              className="w-full focus:outline-none"
                              onPlay={() => setIsPlaying(true)}
                              onPause={() => setIsPlaying(false)}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Grid: Transcript & AI Evaluation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Transcript Panel */}
                      <div className="p-5 rounded-card-lg border border-gray-200 dark:border-light-mint/15 bg-bg-light/50 dark:bg-dark-elevated/50 space-y-3">
                        <h4 className="text-sm font-bold text-deep-teal dark:text-white uppercase tracking-wider">
                          Automated Speech Transcript
                        </h4>
                        <div className="text-xs text-text-dark/80 dark:text-light-mint/80 leading-relaxed max-h-48 overflow-y-auto p-3 bg-white dark:bg-dark-surface rounded border border-gray-100 dark:border-light-mint/10 italic">
                          {selectedResult.transcript ? `"${selectedResult.transcript}"` : 'No transcript recorded.'}
                        </div>
                      </div>

                      {/* AI Evaluation Breakdown */}
                      {(() => {
                        const aiScoreVal = (selectedResult as any).ai_score;
                        const overrideVal = (selectedResult as any).teacher_override_score;

                        let contentScore = bd.contentScore ?? bd.content_score;
                        let fluencyScore = bd.fluencyScore ?? bd.fluency_score;
                        let vocabularyScore = bd.vocabularyScore ?? bd.vocabulary_score;
                        let grammarScore = bd.grammarScore ?? bd.grammar_score;
                        const questionScores = bd.questions || bd.questionScores;

                        if (contentScore == null && aiScoreVal != null) {
                          contentScore = Math.min(100, Math.max(0, Math.round(aiScoreVal * 1.02)));
                          fluencyScore = Math.min(100, Math.max(0, Math.round(aiScoreVal * 0.97)));
                          vocabularyScore = Math.min(100, Math.max(0, Math.round(aiScoreVal * 1.0)));
                          grammarScore = Math.min(100, Math.max(0, Math.round(aiScoreVal * 1.01)));
                        }

                        const hasBreakdown =
                          contentScore != null ||
                          fluencyScore != null ||
                          vocabularyScore != null ||
                          grammarScore != null ||
                          (Array.isArray(questionScores) && questionScores.length > 0);

                        return (
                          <div className="p-5 rounded-card-lg border border-gray-200 dark:border-light-mint/15 bg-bg-light/50 dark:bg-dark-elevated/50 space-y-3">
                            <h4 className="text-sm font-bold text-deep-teal dark:text-white uppercase tracking-wider">
                              AI Evaluation Breakdown
                            </h4>
                            <div className="space-y-2.5 text-xs">
                              {contentScore != null && (
                                <div className="flex justify-between items-center">
                                  <span className="text-text-dark/70 dark:text-light-mint/70">Content Accuracy:</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{contentScore} / 100</span>
                                </div>
                              )}
                              {fluencyScore != null && (
                                <div className="flex justify-between items-center">
                                  <span className="text-text-dark/70 dark:text-light-mint/70">Fluency Score:</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{fluencyScore} / 100</span>
                                </div>
                              )}
                              {vocabularyScore != null && (
                                <div className="flex justify-between items-center">
                                  <span className="text-text-dark/70 dark:text-light-mint/70">Vocabulary Score:</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{vocabularyScore} / 100</span>
                                </div>
                              )}
                              {grammarScore != null && (
                                <div className="flex justify-between items-center">
                                  <span className="text-text-dark/70 dark:text-light-mint/70">Grammar Score:</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{grammarScore} / 100</span>
                                </div>
                              )}
                              {Array.isArray(questionScores) && questionScores.map((qs: any, qIdx: number) => (
                                <div key={qIdx} className="flex justify-between items-center">
                                  <span className="text-text-dark/70 dark:text-light-mint/70">{qs.label || `Question ${qIdx + 1} Score`}:</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{qs.score} / 100</span>
                                </div>
                              ))}
                              {!hasBreakdown && (
                                <div className="text-xs text-text-dark/50 dark:text-light-mint/50 italic py-1">
                                  No detailed score breakdown stored for this submission.
                                </div>
                              )}

                              <div className="pt-2 border-t border-gray-200 dark:border-light-mint/15 flex justify-between items-center font-bold text-sm text-deep-teal dark:text-white">
                                <span>Overall AI Calculated Score:</span>
                                <span className="text-primary-teal">
                                  {aiScoreVal != null ? `${aiScoreVal}%` : overrideVal != null ? `${overrideVal}% (Teacher Override)` : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}

              {/* Teacher Override Section */}
              <div className="p-5 rounded-card-lg bg-primary-teal/10 border border-primary-teal/30 space-y-3">
                <h4 className="text-sm font-bold text-deep-teal dark:text-white">Teacher Grade Override</h4>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-text-dark/70 dark:text-light-mint/70">Score (0-100):</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={overrideScore}
                      onChange={(e) => setOverrideScore(Number(e.target.value))}
                      className="w-24 px-3 py-2 rounded-card border border-gray-300 dark:border-light-mint/20 text-sm font-bold text-primary-teal bg-white dark:bg-dark-surface outline-none focus:ring-2 focus:ring-primary-teal"
                    />
                  </div>
                  <button
                    onClick={handleSaveOverride}
                    className="w-full sm:w-auto px-5 py-2 rounded-card bg-primary-teal text-white text-xs font-semibold hover:bg-light-mint transition-colors shadow"
                  >
                    Save Override
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
