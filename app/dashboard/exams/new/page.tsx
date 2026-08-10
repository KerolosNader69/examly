'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createExam, Question } from '@/lib/exams';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import Breadcrumbs from '@/components/dashboard/Breadcrumbs';
import { examSchema } from '@/lib/schemas';

interface DraftQuestion {
  text: string;
  keywords: string;
  timeLimit: number;
}

const emptyQuestion = (): DraftQuestion => ({ text: '', keywords: '', timeLimit: 60 });

const DRAFT_KEY = 'examly_exam_draft';

export default function CreateExamPage() {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('English');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Restore draft on mount (deferred to avoid synchronous setState in effect)
  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof window === 'undefined') return;
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft && typeof draft.title === 'string') {
          setTitle(draft.title);
          setSubject(draft.subject || 'English');
          setDescription(draft.description || '');
          setQuestions(
            Array.isArray(draft.questions) && draft.questions.length > 0
              ? draft.questions
              : [emptyQuestion()]
          );
        }
      } catch {
        /* ignore corrupt draft */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Autosave draft (debounced)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = setTimeout(() => {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ title, subject, description, questions })
      );
    }, 300);
    return () => clearTimeout(t);
  }, [title, subject, description, questions]);

  const addQuestion = () => setQuestions([...questions, emptyQuestion()]);

  const removeQuestion = (index: number) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof DraftQuestion, value: string | number) => {
    setQuestions(questions.map((q, i) => (i === index ? { ...q, [field]: value } : q)));
  };

  const validate = () => {
    const parsed = examSchema.safeParse({
      title,
      subject,
      description,
      questions: questions
        .filter((q) => q.text.trim())
        .map((q) => ({
          text: q.text,
          keywords: q.keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
          timeLimit: Number(q.timeLimit) || 60,
        })),
    });

    if (parsed.success) {
      setErrors({});
      return { ok: true as const, questions: parsed.data.questions };
    }

    const next: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const [first, second] = issue.path as (string | number)[];
      if (first === 'questions') {
        const idx = typeof second === 'number' ? second : 0;
        const key = `q${idx}`;
        if (!next[key]) next[key] = issue.message;
      } else {
        const key = String(first);
        if (!next[key]) next[key] = issue.message;
      }
    }
    setErrors(next);
    return { ok: false as const, questions: [] };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validate();
    if (!result.ok) {
      toast('Please fix the highlighted fields', 'error');
      return;
    }
    setSubmitting(true);

    const questionList: Question[] = result.questions.map((q, i) => ({
      id: `q-${Date.now()}-${i}`,
      text: q.text.trim(),
      keywords: q.keywords ?? [],
      timeLimit: q.timeLimit,
    }));

    const exam = createExam({
      title: title.trim(),
      subject: subject.trim(),
      description: description.trim(),
      questions: questionList,
      status: 'draft',
    });

    window.localStorage.removeItem(DRAFT_KEY);
    toast('Exam created', 'success');
    router.push(`/dashboard/exams/${exam.id}?created=1`);
  };

  const discardDraft = () => {
    window.localStorage.removeItem(DRAFT_KEY);
    setTitle('');
    setSubject('English');
    setDescription('');
    setQuestions([emptyQuestion()]);
    toast('Draft cleared', 'success');
  };

  const hasDraft = questions.some((q) => q.text.trim()) || title.trim();

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Breadcrumbs />
        <h1 className="text-2xl lg:text-3xl font-bold font-poppins text-deep-teal dark:text-white">Create New Exam</h1>
        <p className="text-text-dark/60 dark:text-light-mint/70 mt-1">Build your oral assessment with questions and evaluation keywords. Your progress is saved automatically.</p>
      </div>

      {hasDraft && (
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-card bg-primary-teal/10 border border-primary-teal/30">
          <p className="text-sm text-primary-teal font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Draft saved locally
          </p>
          <button
            type="button"
            onClick={discardDraft}
            className="text-sm text-text-dark/50 hover:text-error transition-colors font-medium"
          >
            Discard
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8" noValidate>
        {/* Basics */}
        <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
          <h2 className="text-lg font-semibold font-poppins text-deep-teal dark:text-white mb-5">Exam Details</h2>
          <div className="space-y-5">
            <Input
              name="title"
              label="Exam title"
              placeholder="e.g. English Speaking Assessment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Select
                name="subject"
                label="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                error={errors.subject}
              >
                {['English', 'Science', 'History', 'Mathematics', 'Languages', 'Computer Science', 'Other'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <div>
                <label className="block text-sm font-medium text-deep-teal dark:text-light-mint mb-1.5">Questions</label>
                <div className="px-4 py-3 rounded-card bg-bg-light dark:bg-dark-elevated text-text-dark/70 dark:text-light-mint/70 text-sm border border-gray-200 dark:border-light-mint/15">
                  {questions.length} {questions.length === 1 ? 'question' : 'questions'}
                </div>
              </div>
            </div>
            <Textarea
              name="description"
              label="Description (optional)"
              placeholder="Describe the scope of the assessment..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Questions */}
        <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold font-poppins text-deep-teal dark:text-white">Questions</h2>
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-card border-2 border-primary-teal text-primary-teal text-sm font-medium hover:bg-primary-teal hover:text-white transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Question
            </button>
          </div>

          <div className="space-y-6">
            {questions.map((question, index) => (
              <div
                key={index}
                className="relative rounded-card border border-gray-200 dark:border-light-mint/15 p-5 bg-bg-light/40 dark:bg-dark-elevated/60"
              >
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="absolute top-4 right-4 p-1.5 rounded-full text-text-dark/40 hover:text-error hover:bg-error/10 transition-colors"
                    title="Remove question"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-teal text-white text-sm font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-text-dark/50 dark:text-light-mint/50">Question</span>
                  </div>
                  <Textarea
                    name={`question-${index}`}
                    label="Question text"
                    placeholder="Type the oral question the student will answer..."
                    value={question.text}
                    onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                    error={errors[`q${index}`]}
                    className="min-h-20"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      name={`keywords-${index}`}
                      label="Keywords (comma separated)"
                      placeholder="e.g. fluency, vocabulary, pronunciation"
                      value={question.keywords}
                      onChange={(e) => updateQuestion(index, 'keywords', e.target.value)}
                    />
                    <div>
                      <label className="block text-sm font-medium text-deep-teal dark:text-light-mint mb-1.5">Time limit (seconds)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={30}
                          max={180}
                          step={15}
                          value={question.timeLimit}
                          onChange={(e) => updateQuestion(index, 'timeLimit', Number(e.target.value))}
                          className="flex-1 accent-primary-teal"
                        />
                        <span className="w-16 text-center px-2 py-1.5 rounded bg-white dark:bg-dark-surface border border-gray-200 dark:border-light-mint/15 text-sm font-medium text-deep-teal dark:text-light-mint">
                          {question.timeLimit}s
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-6 py-3.5 rounded-card bg-primary-teal text-white font-semibold text-lg hover:bg-light-mint disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            {submitting ? 'Creating...' : 'Create Exam'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/exams')}
            className="px-6 py-3.5 rounded-card border-2 border-primary-teal text-primary-teal font-semibold hover:bg-primary-teal/5 transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
