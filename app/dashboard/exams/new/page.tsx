'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import Breadcrumbs from '@/components/dashboard/Breadcrumbs';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/authedFetch';
import {
  formatIssue,
  mapGeneratedQuestion,
  saveExam,
  toLocalDateTimeInput,
  validateDraftModels,
  validateSchedule,
  type ExamDb,
  type GeneratedQuestion,
} from '@/lib/examCreate';
import { MIN_QUESTION_TIME_LIMIT_SECONDS, defaultTimeLimitFor, maxTimeLimitFor } from '@/lib/examPublic';
import {
  DEFAULT_EXAM_LANGUAGE,
  DEFAULT_WRONG_LANGUAGE_POLICY,
  EXAM_LANGUAGES,
  WRONG_LANGUAGE_POLICIES,
  WRONG_LANGUAGE_POLICY_LABELS,
  examLanguageLabel,
  type WrongLanguagePolicy,
} from '@/lib/examLanguage';

type ExamType = 'audio' | 'video' | 'mcq' | 'essay';

interface DraftQuestion {
  id: string;
  text: string;
  modelAnswer: string;
  timeLimit: number;
  options?: string[];
  /** null = not chosen yet (the teacher must mark the correct option). */
  correctOptionIndex?: number | null;
  isAiGenerated?: boolean;
}

interface ModelTab {
  id: string;
  name: string;
  questions: DraftQuestion[];
}

const emptyQuestion = (type: ExamType = 'audio'): DraftQuestion => ({
  id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
  text: '',
  modelAnswer: '',
  timeLimit: defaultTimeLimitFor(type),
  options: type === 'mcq' ? ['', '', '', ''] : undefined,
  correctOptionIndex: null,
});

export default function CreateExamPage() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 State
  const [title, setTitle] = useState('');
  const [examType, setExamType] = useState<ExamType>('audio');
  const [subject, setSubject] = useState('English');
  const [language, setLanguage] = useState<string>(DEFAULT_EXAM_LANGUAGE);
  const [wrongLanguagePolicy, setWrongLanguagePolicy] = useState<WrongLanguagePolicy>(DEFAULT_WRONG_LANGUAGE_POLICY);
  const [startDate, setStartDate] = useState(() => toLocalDateTimeInput(new Date()));
  const [endDate, setEndDate] = useState(() => toLocalDateTimeInput(new Date(Date.now() + 7 * 86400000)));

  // Step 2 State
  const [models, setModels] = useState<ModelTab[]>([
    { id: 'model-a', name: 'Model A', questions: [emptyQuestion('audio')] },
  ]);
  const [activeModelId, setActiveModelId] = useState('model-a');

  // PDF Upload State
  const [pdfUploading, setPdfUploading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Step 3 State & Completion
  const [submitting, setSubmitting] = useState(false);
  const [publishedCode, setPublishedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // When changing examType in Step 1, update existing questions' option defaults
  const handleExamTypeChange = (newType: ExamType) => {
    const oldDefault = defaultTimeLimitFor(examType);
    setExamType(newType);
    setModels((prev) =>
      prev.map((m) => ({
        ...m,
        questions: m.questions.map((q) => ({
          ...q,
          // Untouched limits follow the type default (essay 600 s, others 60 s).
          // Switching to video caps longer limits at 300 s.
          timeLimit: q.timeLimit === oldDefault ? defaultTimeLimitFor(newType) : Math.min(q.timeLimit, maxTimeLimitFor(newType)),
          options: newType === 'mcq' ? (q.options && q.options.length === 4 ? q.options : ['', '', '', '']) : undefined,
          correctOptionIndex: q.correctOptionIndex ?? null,
        })),
      }))
    );
  };

  // Model & Question Handlers
  const activeModel = models.find((m) => m.id === activeModelId) || models[0];

  const addModel = () => {
    const nextChar = String.fromCharCode(65 + models.length); // A, B, C, D...
    const newId = `model-${nextChar.toLowerCase()}`;
    const newModel: ModelTab = { id: newId, name: `Model ${nextChar}`, questions: [emptyQuestion(examType)] };
    setModels([...models, newModel]);
    setActiveModelId(newId);
  };

  const addQuestionToModel = () => {
    setModels(
      models.map((m) =>
        m.id === activeModelId ? { ...m, questions: [...m.questions, emptyQuestion(examType)] } : m
      )
    );
  };

  const removeQuestionFromModel = (qId: string) => {
    if (activeModel.questions.length <= 1) {
      toast('Model must have at least one question', 'error');
      return;
    }
    setModels(
      models.map((m) =>
        m.id === activeModelId ? { ...m, questions: m.questions.filter((q) => q.id !== qId) } : m
      )
    );
  };

  const updateQuestionField = (qId: string, field: keyof DraftQuestion, value: any) => {
    setModels(
      models.map((m) =>
        m.id === activeModelId
          ? {
              ...m,
              questions: m.questions.map((q) => {
                if (q.id !== qId) return q;
                const updated: any = { ...q, [field]: value };
                // Clear AI badge when teacher edits the question text (indicates review)
                if (field === 'text' && q.isAiGenerated) {
                  updated.isAiGenerated = false;
                }
                return updated;
              }),
            }
          : m
      )
    );
  };

  const updateOptionText = (qId: string, optionIndex: number, text: string) => {
    setModels(
      models.map((m) =>
        m.id === activeModelId
          ? {
              ...m,
              questions: m.questions.map((q) => {
                if (q.id !== qId) return q;
                const newOpts = [...(q.options || ['', '', '', ''])];
                newOpts[optionIndex] = text;
                return { ...q, options: newOpts };
              }),
            }
          : m
      )
    );
  };

  const setCorrectOption = (qId: string, optionIndex: number) => {
    setModels(
      models.map((m) =>
        m.id === activeModelId
          ? {
              ...m,
              questions: m.questions.map((q) =>
                q.id === qId ? { ...q, correctOptionIndex: optionIndex } : q
              ),
            }
          : m
      )
    );
  };

  // Reordering handler
  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= activeModel.questions.length) return;
    const reordered = [...activeModel.questions];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    setModels(models.map((m) => (m.id === activeModelId ? { ...m, questions: reordered } : m)));
  };

  // PDF Upload Handler
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be re-selected
    if (pdfInputRef.current) pdfInputRef.current.value = '';

    // Client-side size check
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      toast(`File is too large (${sizeMB} MB). Maximum is 10 MB.`, 'error');
      return;
    }

    setPdfUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // 90s client timeout (slightly longer than server's 60s Gemini timeout
      // so the server can return its own error message when possible)
      const res = await authedFetch('/api/exam/generate-from-pdf', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(90_000),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast(data.error || 'Failed to process document', 'error');
        return;
      }

      // Same schema as manually created questions (shared mapper; the server already applied it).
      const mapped = (Array.isArray(data.questions) ? data.questions : [])
        .map(mapGeneratedQuestion)
        .filter((q: GeneratedQuestion | null): q is GeneratedQuestion => q !== null);
      if (mapped.length === 0) {
        toast('No usable questions were found in this document.', 'error');
        return;
      }
      const hasMcq = mapped.some((q: GeneratedQuestion) => q.questionType === 'mcq');
      const targetType: ExamType = hasMcq ? 'mcq' : examType;
      const aiQuestions: DraftQuestion[] = mapped.map((q: GeneratedQuestion) => ({
        id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        text: q.questionText,
        modelAnswer: q.modelAnswerText,
        timeLimit: defaultTimeLimitFor(targetType),
        options: targetType === 'mcq' ? [0, 1, 2, 3].map((i) => (q.options && q.options[i]) || '') : undefined,
        correctOptionIndex: q.correctOptionIndex,
        isAiGenerated: true,
      }));

      // If the document contains MCQ questions, switch the exam to MCQ so the options UI renders.
      if (hasMcq && examType !== 'mcq') {
        handleExamTypeChange('mcq');
        toast('Document contains multiple-choice questions: exam type switched to MCQ.', 'info');
      }

      // Append to the active model, keeping its non-empty questions (functional update so the
      // exam-type change above is not overwritten by a stale copy of `models`).
      setModels((prev) =>
        prev.map((m) =>
          m.id === activeModelId
            ? { ...m, questions: [...m.questions.filter((q) => q.text.trim() !== ''), ...aiQuestions] }
            : m
        )
      );
      const unknownKeys = aiQuestions.filter((q) => targetType === 'mcq' && q.correctOptionIndex == null).length;
      if (unknownKeys > 0) toast(`${unknownKeys} question(s) have no correct option in the document: mark them before publishing.`, 'info');

      const modeLabel = data.mode === 'extracted' ? 'extracted from' : 'generated from';
      toast(`${aiQuestions.length} questions ${modeLabel} document — review before publishing`, 'success');
    } catch (err: any) {
      console.error('PDF upload error:', err);
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        toast('Request timed out — the document may be too large or complex. Try a shorter file.', 'error');
      } else {
        toast('Failed to process document. Please try again.', 'error');
      }
    } finally {
      setPdfUploading(false);
    }
  };

  // Step 1 Validation
  const validateStep1 = () => {
    if (!title.trim()) {
      toast('Please enter an exam title', 'error');
      return false;
    }
    const scheduleError = validateSchedule(startDate, endDate);
    if (scheduleError) {
      toast(scheduleError, 'error');
      return false;
    }
    return true;
  };

  const issues = validateDraftModels(examType, models);

  // Saves everything or nothing (lib/examCreate.ts): the exam is inserted as a draft,
  // variants/questions are checked, and only then published; any failure rolls back.
  const handlePublish = async (status: 'published' | 'draft') => {
    if (submitting) return;
    if (status === 'published' && issues.length > 0) {
      toast(`Cannot publish yet: ${formatIssue(issues[0])}`, 'error');
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast('You must be logged in to create an exam', 'error');
        return;
      }
      const result = await saveExam(supabase as unknown as ExamDb, {
        teacherId: user.id,
        title,
        examType,
        subject,
        language,
        wrongLanguagePolicy,
        startTime: startDate ? new Date(startDate).toISOString() : null,
        endTime: endDate ? new Date(endDate).toISOString() : null,
        status,
        models: models.map((m) => ({ name: m.name, questions: m.questions })),
      });
      if (!result.ok) {
        toast(result.error, 'error');
        return;
      }
      setPublishedCode(result.examId);
      toast(status === 'published' ? 'Exam published successfully!' : 'Draft saved successfully!', 'success');
    } catch (err: any) {
      console.error('Create exam submission error:', err);
      toast(err.message || 'An error occurred while creating the exam', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!publishedCode) return;
    const link = `${window.location.origin}/exam/${publishedCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast('Unlisted exam link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <Breadcrumbs />
        <h1 className="text-2xl lg:text-3xl font-bold font-poppins text-deep-teal dark:text-white mt-1">Create Exam</h1>
        <p className="text-text-dark/60 dark:text-light-mint/70">Build your custom exam, reorder questions, and assign question models.</p>
      </div>

      {/* Progress Indicator */}
      <div className="bg-white dark:bg-dark-surface p-6 rounded-card-lg border border-primary-teal/10 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-teal">
            Step {step} of 3
          </span>
          <span className="text-sm font-semibold text-deep-teal dark:text-light-mint">
            {step === 1 ? 'Step 1: Basic Details' : step === 2 ? 'Step 2: Question Builder' : 'Step 3: Review & Publish'}
          </span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-dark-elevated rounded-full overflow-hidden flex">
          <div
            className="h-full bg-primary-teal transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Published State Overlay Card */}
      {publishedCode ? (
        <div className="bg-white dark:bg-dark-surface p-8 rounded-card-lg border border-primary-teal/20 shadow-xl text-center space-y-6 animate-fade-in-up">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white">Exam Created Successfully!</h2>
            <p className="text-sm text-text-dark/60 dark:text-light-mint/70 mt-1">Share the unlisted link below with your students to begin taking the exam.</p>
          </div>

          <div className="max-w-md mx-auto p-4 rounded-card bg-bg-light dark:bg-dark-elevated border border-gray-200 dark:border-light-mint/15 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="font-mono text-sm text-primary-teal font-bold truncate">
              {typeof window !== 'undefined' ? `${window.location.origin}/exam/${publishedCode}` : `/exam/${publishedCode}`}
            </span>
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 rounded-card bg-primary-teal text-white text-xs font-semibold hover:bg-light-mint transition-colors whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          <div className="flex justify-center gap-4 pt-4">
            <button
              onClick={() => router.push('/dashboard/exams')}
              className="px-6 py-3 rounded-card bg-deep-teal text-white font-semibold text-sm hover:bg-deep-teal/90 transition-colors"
            >
              Go to My Exams
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* STEP 1 — Basic Details */}
          {step === 1 && (
            <div className="bg-white dark:bg-dark-surface p-8 rounded-card-lg border border-primary-teal/10 shadow-sm space-y-6">
              <h2 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">Basic Details</h2>

              <Input
                name="title"
                label="Exam Title"
                placeholder="e.g. Science Quiz - Multiple Choice"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div>
                <label className="block text-sm font-medium text-deep-teal dark:text-light-mint mb-2">Exam Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { id: 'audio', label: 'Audio Only', desc: 'Voice recording only', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
                    { id: 'video', label: 'Audio + Video', desc: 'Voice & webcam video', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                    { id: 'mcq', label: 'MCQ Quiz', desc: 'Multiple choice questions', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                    { id: 'essay', label: 'Essay', desc: 'Long form written response', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleExamTypeChange(type.id as ExamType)}
                      className={`p-4 rounded-card border-2 text-left transition-all flex flex-col justify-between ${
                        examType === type.id
                          ? 'border-primary-teal bg-primary-teal/5 text-primary-teal'
                          : 'border-gray-200 dark:border-light-mint/15 bg-white dark:bg-dark-surface text-text-dark/70 dark:text-light-mint/70 hover:border-primary-teal/40'
                      }`}
                    >
                      <svg className="w-6 h-6 mb-3 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={type.icon} />
                      </svg>
                      <div>
                        <p className="font-semibold text-sm text-deep-teal dark:text-white">{type.label}</p>
                        <p className="text-xs text-text-dark/50 dark:text-light-mint/50 mt-0.5">{type.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select
                  name="subject"
                  label="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  {['English', 'Science', 'History', 'Mathematics', 'Spanish', 'French', 'Other'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>

                <Select
                  name="language"
                  label="Exam language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {EXAM_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label} ({l.code})
                    </option>
                  ))}
                </Select>

                {examType !== 'mcq' && (
                  <Select
                    name="wrongLanguagePolicy"
                    label="Answer in another language"
                    value={wrongLanguagePolicy}
                    onChange={(e) => setWrongLanguagePolicy(e.target.value as WrongLanguagePolicy)}
                  >
                    {WRONG_LANGUAGE_POLICIES.map((p) => (
                      <option key={p} value={p}>
                        {WRONG_LANGUAGE_POLICY_LABELS[p]}
                      </option>
                    ))}
                  </Select>
                )}

                <div>
                  <label className="block text-sm font-medium text-deep-teal dark:text-light-mint mb-1.5">Start Date / Time</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-card border border-gray-200 bg-white dark:bg-dark-surface text-text-dark dark:text-light-mint text-sm outline-none focus:ring-2 focus:ring-primary-teal/30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-deep-teal dark:text-light-mint mb-1.5">End Date / Time</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-card border border-gray-200 bg-white dark:bg-dark-surface text-text-dark dark:text-light-mint text-sm outline-none focus:ring-2 focus:ring-primary-teal/30"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1()) setStep(2);
                  }}
                  className="px-6 py-3 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint transition-colors shadow-md"
                >
                  Next: Question Builder &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — Question Builder */}
          {step === 2 && (
            <div className="bg-white dark:bg-dark-surface p-8 rounded-card-lg border border-primary-teal/10 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">Question Builder</h2>
                    <span className="px-2.5 py-0.5 rounded text-xs uppercase font-mono font-bold bg-primary-teal/10 text-primary-teal">
                      {examType.toUpperCase()} MODE
                    </span>
                  </div>
                  <p className="text-xs text-text-dark/50 dark:text-light-mint/50">Manage question sets and answers for this {examType} assessment</p>
                </div>
                <button
                  type="button"
                  onClick={addModel}
                  className="px-3.5 py-2 rounded-card border border-primary-teal text-primary-teal text-xs font-semibold hover:bg-primary-teal/10 transition-colors"
                >
                  + Add Model Variant
                </button>
              </div>

              {/* Model Tabs */}
              <div className="flex border-b border-gray-200 dark:border-light-mint/15 gap-2 overflow-x-auto">
                {models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveModelId(m.id)}
                    className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                      activeModelId === m.id
                        ? 'border-primary-teal text-primary-teal'
                        : 'border-transparent text-text-dark/60 dark:text-light-mint/60 hover:text-deep-teal'
                    }`}
                  >
                    {m.name} ({m.questions.length})
                  </button>
                ))}
              </div>

              {/* Repeatable Question Blocks */}
              <div className="space-y-6">
                {activeModel.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-6 rounded-2xl border border-gray-200 dark:border-light-mint/15 bg-bg-light/40 dark:bg-dark-elevated/40 space-y-5 relative shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Reorder Buttons */}
                        <div className="flex flex-col gap-0.5 text-text-dark/30 dark:text-light-mint/30 hover:text-primary-teal">
                          <button type="button" onClick={() => moveQuestion(idx, 'up')} title="Move Up" className="p-0.5">
                            ▲
                          </button>
                          <button type="button" onClick={() => moveQuestion(idx, 'down')} title="Move Down" className="p-0.5">
                            ▼
                          </button>
                        </div>
                        <span className="w-7 h-7 rounded-full bg-primary-teal text-white text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-base font-bold text-deep-teal dark:text-light-mint">Question {idx + 1}</span>
                        {/* AI-suggested badge */}
                        {q.isAiGenerated && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 animate-pulse">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            AI-suggested — review before publishing
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeQuestionFromModel(q.id)}
                        className="text-text-dark/40 hover:text-error transition-colors p-1"
                        title="Delete question"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    <Textarea
                      name={`q-text-${q.id}`}
                      label="Question Prompt / Title"
                      placeholder={examType === 'mcq' ? 'e.g. What primary pigment absorbs light during photosynthesis?' : 'Enter the prompt or question for students...'}
                      value={q.text}
                      onChange={(e) => updateQuestionField(q.id, 'text', e.target.value)}
                    />

                    {/* DYNAMIC QUESTION EDITOR PER EXAM TYPE */}

                    {/* 1. MCQ OPTIONS EDITOR & CORRECT ANSWER SELECTION */}
                    {examType === 'mcq' && (
                      <div className="p-5 rounded-xl bg-white dark:bg-dark-surface border border-primary-teal/20 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-deep-teal dark:text-light-mint uppercase tracking-wider">
                            Multiple Choice Options (Select Correct Answer)
                          </span>
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200/50">
                            {q.correctOptionIndex == null ? 'Correct answer: not set' : `Correct Answer: Option ${String.fromCharCode(65 + q.correctOptionIndex)}`}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {['A', 'B', 'C', 'D'].map((letter, oIdx) => {
                            const isCorrect = q.correctOptionIndex === oIdx;
                            const optionValue = (q.options && q.options[oIdx]) || '';
                            return (
                              <div
                                key={oIdx}
                                className={`p-3 rounded-xl border-2 transition-all space-y-2 ${
                                  isCorrect
                                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                                    : 'border-gray-200 dark:border-light-mint/15 bg-bg-light/30 dark:bg-dark-elevated/30'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                                      {letter}
                                    </span>
                                    <span className="text-xs font-semibold text-deep-teal dark:text-light-mint">Option {letter}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setCorrectOption(q.id, oIdx)}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                                      isCorrect
                                        ? 'bg-emerald-500 text-white shadow'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-light-mint'
                                    }`}
                                  >
                                    {isCorrect ? '✓ Correct Answer' : 'Mark Correct'}
                                  </button>
                                </div>

                                <input
                                  type="text"
                                  placeholder={`Enter choice option ${letter}...`}
                                  value={optionValue}
                                  onChange={(e) => updateOptionText(q.id, oIdx, e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-light-mint/15 text-xs bg-white dark:bg-dark-surface text-deep-teal dark:text-white outline-none focus:ring-2 focus:ring-primary-teal/30"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 2. MODEL ANSWER / EVALUATION CRITERIA */}
                    <Textarea
                      name={`q-ans-${q.id}`}
                      label={examType === 'mcq' ? 'Explanation / Solution Notes' : 'Model Answer / Evaluation Criteria'}
                      placeholder={examType === 'mcq' ? 'Explain why the correct answer is right (shown to students after completion)...' : 'Describe what a top student response should cover...'}
                      value={q.modelAnswer}
                      onChange={(e) => updateQuestionField(q.id, 'modelAnswer', e.target.value)}
                    />

                    <div>
                      <label htmlFor={`time-${q.id}`} className="block text-xs font-medium text-deep-teal dark:text-light-mint mb-1">
                        Time Limit (seconds) <span className="font-normal text-text-dark/50 dark:text-light-mint/50">{MIN_QUESTION_TIME_LIMIT_SECONDS}–{maxTimeLimitFor(examType)}{examType === 'video' ? ' (video max)' : ''}</span>
                      </label>
                      <input
                        id={`time-${q.id}`}
                        type="number"
                        min={MIN_QUESTION_TIME_LIMIT_SECONDS}
                        max={maxTimeLimitFor(examType)}
                        step={1}
                        value={Number.isFinite(q.timeLimit) ? q.timeLimit : ''}
                        onChange={(e) => updateQuestionField(q.id, 'timeLimit', e.target.value === '' ? NaN : Number(e.target.value))}
                        className="w-32 px-3 py-1.5 rounded-card border border-gray-200 dark:border-light-mint/15 text-sm bg-white dark:bg-dark-surface text-text-dark dark:text-light-mint"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* PDF Upload Loading Overlay */}
              {pdfUploading && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="bg-white dark:bg-dark-surface p-8 rounded-card-lg shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
                    <div className="w-12 h-12 border-4 border-primary-teal/20 border-t-primary-teal rounded-full animate-spin" />
                    <div className="text-center">
                      <p className="text-lg font-bold text-deep-teal dark:text-white">Analyzing Document with AI</p>
                      <p className="text-sm text-text-dark/60 dark:text-light-mint/60 mt-1">
                        Extracting or generating questions from your document...
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={addQuestionToModel}
                    className="px-4 py-2 rounded-card border-2 border-primary-teal text-primary-teal text-sm font-semibold hover:bg-primary-teal/10 transition-colors"
                  >
                    + Add Question
                  </button>

                  {/* Generate from PDF Button */}
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handlePdfUpload}
                    className="hidden"
                    id="pdf-upload-input"
                  />
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={pdfUploading}
                    className="px-4 py-2 rounded-card bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:from-amber-600 hover:to-orange-600 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {pdfUploading ? 'Processing...' : 'Generate from PDF'}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-5 py-2.5 rounded-card border border-gray-300 dark:border-light-mint/20 text-sm font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-6 py-2.5 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint transition-colors shadow-md"
                  >
                    Next: Review &amp; Publish &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Review & Publish */}
          {step === 3 && (
            <div className="bg-white dark:bg-dark-surface p-8 rounded-card-lg border border-primary-teal/10 shadow-sm space-y-6">
              <h2 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">Review &amp; Publish</h2>

              {/* Summary Card */}
              <div className="p-6 rounded-card border border-primary-teal/20 bg-bg-light/60 dark:bg-dark-elevated/60 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-light-mint/15 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-deep-teal dark:text-white">{title || 'Untitled Exam'}</h3>
                    <p className="text-xs text-text-dark/60 dark:text-light-mint/60">Subject: {subject} · Type: {examType.toUpperCase()} · Language: {examLanguageLabel(language)}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-primary-teal/10 text-primary-teal font-mono text-xs font-bold">
                    Code: Auto-assigned
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-text-dark/50 dark:text-light-mint/50">Start Time:</span>
                    <p className="font-semibold text-deep-teal dark:text-light-mint">{startDate}</p>
                  </div>
                  <div>
                    <span className="text-text-dark/50 dark:text-light-mint/50">End Time:</span>
                    <p className="font-semibold text-deep-teal dark:text-light-mint">{endDate}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-xs font-semibold text-deep-teal dark:text-light-mint uppercase tracking-wider">Models Included:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {models.map((m) => (
                      <span key={m.id} className="px-3 py-1 rounded bg-white dark:bg-dark-surface border border-gray-200 dark:border-light-mint/15 text-xs font-medium">
                        {m.name}: {m.questions.length} questions
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {issues.length > 0 && (
                <div role="alert" className="p-4 rounded-card border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold">Fix these before publishing (you can still save a draft):</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {issues.slice(0, 8).map((i, k) => (
                      <li key={k}>{formatIssue(i)}</li>
                    ))}
                    {issues.length > 8 && <li>…and {issues.length - 8} more</li>}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-card border border-gray-300 dark:border-light-mint/20 text-sm font-medium"
                >
                  Back to Questions
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handlePublish('draft')}
                    className="px-5 py-3 rounded-card border-2 border-primary-teal text-primary-teal font-semibold text-sm hover:bg-primary-teal/5 transition-colors"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    disabled={submitting || issues.length > 0}
                    onClick={() => handlePublish('published')}
                    className="px-6 py-3 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Publishing...' : 'Publish Exam'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
