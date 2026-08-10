'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getExamByCode, addResult } from '@/lib/exams';
import Input from '@/components/ui/Input';

type Stage = 'join' | 'instructions' | 'answering' | 'submitting' | 'done';

function simulateScore() {
  const base = 70 + Math.round(Math.random() * 28);
  return {
    pronunciation: base + Math.round(Math.random() * 8 - 4),
    vocabulary: base + Math.round(Math.random() * 8 - 4),
    fluency: base + Math.round(Math.random() * 8 - 4),
    grammar: base + Math.round(Math.random() * 8 - 4),
  };
}

export default function StudentExamPage() {
  const params = useParams<{ code: string }>();
  const exam = getExamByCode(params.code);

  const [stage, setStage] = useState<Stage>(exam ? 'join' : 'done');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [breakdown, setBreakdown] = useState<{ label: string; score: number }[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const question = exam?.questions[current];

  const finishAnswer = () => {
    setIsRecording(false);
    setMicOn(false);
    setCamOn(false);
    setStage('submitting');
    setTimeout(() => {
      const s = simulateScore();
      const parts = [
        { label: 'Pronunciation', score: s.pronunciation },
        { label: 'Vocabulary', score: s.vocabulary },
        { label: 'Fluency', score: s.fluency },
        { label: 'Grammar', score: s.grammar },
      ];
      const avg = Math.round(parts.reduce((sum, p) => sum + p.score, 0) / parts.length);
      setScore(avg);
      setBreakdown(parts);
      setStage('done');

      if (exam) {
        addResult({
          examId: exam.id,
          name: name || 'Anonymous Student',
          score: avg,
          submittedAt: new Date().toISOString(),
        });
      }
    }, 1200);
  };

  // Timer for answering
  useEffect(() => {
    if (stage !== 'answering' || !question || isPaused) return;
    if (timeLeft <= 0) {
      timerRef.current = setTimeout(finishAnswer, 0);
      return;
    }
    timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, question, timeLeft, isPaused]);

  const startExam = () => {
    setStage('instructions');
  };

  const beginQuestions = () => {
    setCurrent(0);
    setTimeLeft(question?.timeLimit ?? 60);
    setStage('answering');
    setIsRecording(true);
    setMicOn(true);
    setCamOn(true);
  };

  const togglePause = () => {
    setIsPaused((p) => !p);
    setIsRecording((r) => !r);
  };

  const nextQuestion = () => {
    if (!exam || current >= exam.questions.length - 1) {
      finishAnswer();
      return;
    }
    setCurrent((c) => c + 1);
    setTimeLeft(exam.questions[current + 1].timeLimit);
    setIsRecording(true);
    setMicOn(true);
    setCamOn(true);
  };

  const skipQuestion = () => {
    setIsPaused(false);
    nextQuestion();
  };

  // ---- Not found ----
  if (!exam) {
    return (
      <div className="min-h-screen bg-bg-light dark:bg-deep-teal flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary-teal/10 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-3">Exam not found</h1>
          <p className="text-text-dark/60 dark:text-light-mint/70 mb-6">The exam code you entered doesn&apos;t match any active exam. Please check the link or code with your teacher.</p>
          <Link
            href="/"
            className="inline-flex px-6 py-3 rounded-card bg-primary-teal text-white font-medium hover:bg-light-mint transition-colors"
          >
            Go to Examly
          </Link>
        </div>
      </div>
    );
  }

  const progress = Math.round((current / exam.questions.length) * 100);
  const formattedTime = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`;

  // ---- Join ----
  if (stage === 'join') {
    return (
      <div className="min-h-screen bg-bg-light dark:bg-deep-teal flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Image src="/assets/logo/screen-removebg-preview.png" alt="Examly Logo" width={140} height={56} className="object-contain" />
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-card-lg shadow-lg p-8 border border-primary-teal/10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-light-mint/20 border border-primary-teal/30 mb-6">
              <svg className="w-4 h-4 text-primary-teal" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-semibold text-primary-teal">{exam.code}</span>
            </div>

            <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-1">{exam.title}</h1>
            <p className="text-text-dark/60 dark:text-light-mint/70 mb-2">{exam.subject} · {exam.questions.length} questions</p>
            {exam.description && <p className="text-sm text-text-dark/50 dark:text-light-mint/50 mb-6">{exam.description}</p>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) {
                  setNameError('Please enter your name to continue');
                  return;
                }
                startExam();
              }}
              className="space-y-4"
              noValidate
            >
              <Input
                name="name"
                label="Your full name"
                placeholder="e.g. Jordan Lee"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError('');
                }}
                error={nameError}
              />
              <button
                type="submit"
                className="w-full px-6 py-3.5 rounded-card bg-primary-teal text-white font-semibold text-lg hover:bg-light-mint transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Start Exam
              </button>
              <p className="text-xs text-center text-text-dark/50 dark:text-light-mint/50">
                By starting, you agree to the exam&apos;s integrity guidelines.
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---- Instructions ----
  if (stage === 'instructions') {
    const checks = [
      { title: 'Quiet environment', desc: 'Make sure you are in a quiet space', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
      { title: 'Microphone ready', desc: 'Allow mic access when prompted', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
      { title: 'Answer aloud', desc: 'Speak clearly and answer in full sentences', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    ];
    return (
      <div className="min-h-screen bg-bg-light dark:bg-deep-teal flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="bg-white dark:bg-dark-surface rounded-card-lg shadow-lg p-8 border border-primary-teal/10">
            <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-2">Ready to begin, {name}?</h1>
            <p className="text-text-dark/60 dark:text-light-mint/70 mb-6">Please review the guidelines before starting your exam.</p>

            <div className="space-y-4 mb-8">
              {checks.map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-card bg-bg-light/60 dark:bg-dark-elevated/60">
                  <div className="w-10 h-10 rounded-full bg-primary-teal/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-deep-teal dark:text-light-mint">{item.title}</p>
                    <p className="text-sm text-text-dark/60 dark:text-light-mint/60">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-4 rounded-card bg-deep-teal text-white mb-6">
              <span className="text-sm text-light-mint/90">You will answer</span>
              <span className="font-bold">
                {exam.questions.length} {exam.questions.length === 1 ? 'question' : 'questions'}
              </span>
              <span className="text-sm text-light-mint/90">
                ≈ {Math.ceil(exam.questions.reduce((s, q) => s + q.timeLimit, 0) / 60)} min
              </span>
            </div>

            <button
              onClick={beginQuestions}
              className="w-full px-6 py-3.5 rounded-card bg-primary-teal text-white font-semibold text-lg hover:bg-light-mint transition-all duration-200 shadow-md hover:shadow-lg"
            >
              I&apos;m Ready
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Answering ----
  if (stage === 'answering' && question) {
    return (
      <div className="min-h-screen bg-deep-teal flex flex-col">
        {/* Top bar */}
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/assets/logo/screen-removebg-preview.png" alt="Examly" width={100} height={40} className="object-contain" />
          </div>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1.5 rounded-full text-sm font-mono font-bold ${timeLeft <= 10 ? 'bg-error text-white animate-pulse' : 'bg-white/10 text-light-mint'}`}>
              {formattedTime}
            </span>
            <button
              onClick={togglePause}
              className="p-2 rounded-full bg-white/10 text-light-mint hover:bg-white/20 transition-colors"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="px-6">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary-teal transition-all duration-500" style={{ width: `${progress + 100 / exam.questions.length}%` }}></div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            {/* Question card */}
            <div className="bg-white rounded-card-lg shadow-xl p-8 text-center mb-6 dark:bg-dark-elevated dark:border dark:border-light-mint/10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-light-mint/20 border border-primary-teal/30 mb-6">
                <span className="text-xs font-semibold text-primary-teal">
                  Question {current + 1} of {exam.questions.length}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-semibold font-poppins text-deep-teal dark:text-light-mint leading-relaxed">
                {question.text}
              </h2>
            </div>

            {/* Recording / camera view */}
            <div className="rounded-card-lg overflow-hidden border border-light-mint/20 bg-deep-teal/60 relative">
              <div className="flex items-center justify-center h-56 relative">
                {/* Fake webcam grid */}
                <div className="absolute inset-0 bg-gradient-to-br from-deep-teal to-primary-teal/30"></div>
                <div className="absolute inset-0 opacity-10 hero-pattern"></div>

                {/* Webcam window */}
                <div className="relative w-40 h-40 rounded-full border-4 border-light-mint/40 overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-deep-teal/70"></div>
                  <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${camOn ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="text-6xl text-light-mint/80">{name.charAt(0).toUpperCase() || 'S'}</div>
                  </div>
                  {isRecording && (
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-error/90 text-white text-[10px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      REC
                    </div>
                  )}
                </div>

                {/* Recording controls */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
                  <button
                    onClick={() => setMicOn(!micOn)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                      micOn ? 'bg-white text-deep-teal' : 'bg-white/15 text-white/40'
                    }`}
                    title="Toggle microphone"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {micOn ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      )}
                    </svg>
                  </button>
                  <button
                    onClick={() => setCamOn(!camOn)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                      camOn ? 'bg-white text-deep-teal' : 'bg-white/15 text-white/40'
                    }`}
                    title="Toggle camera"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {camOn ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      )}
                    </svg>
                  </button>
                  {isPaused ? (
                    <button
                      onClick={togglePause}
                      className="h-12 px-6 rounded-full bg-gold-accent text-deep-teal font-semibold text-sm"
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      onClick={nextQuestion}
                      className="h-12 px-6 rounded-full bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint transition-colors"
                    >
                      {current === exam.questions.length - 1 ? 'Submit' : 'Next Question'}
                    </button>
                  )}
                </div>

                {/* Live waveform */}
                {isRecording && (
                  <div className="absolute top-4 right-4 flex items-end h-6 gap-0.5">
                    {[8, 16, 12, 20, 10, 18, 14, 22, 9, 15].map((h, i) => (
                      <div
                        key={i}
                        className="w-1 bg-light-mint rounded-t animate-pulse"
                        style={{ height: `${h}px`, animationDelay: `${i * 0.1}s`, animationDuration: '0.9s' }}
                      ></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Skip hint */}
            <div className="text-center mt-4">
              <button onClick={skipQuestion} className="text-sm text-light-mint/50 hover:text-light-mint transition-colors">
                Skip question
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Submitting ----
  if (stage === 'submitting') {
    return (
      <div className="min-h-screen bg-deep-teal flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-full border-4 border-primary-teal/30 border-t-primary-teal animate-spin mb-8"></div>
          <h2 className="text-2xl font-bold font-poppins text-white mb-2">Grading your response...</h2>
          <p className="text-light-mint/70">Our AI is analyzing pronunciation, vocabulary, and fluency.</p>
        </div>
      </div>
    );
  }

  // ---- Done ----
  const gradeLabel = score >= 80 ? 'Excellent work!' : score >= 60 ? 'Good job!' : 'Keep practicing!';

  return (
    <div className="min-h-screen bg-bg-light dark:bg-deep-teal flex items-center justify-center p-6 py-12">
      <div className="w-full max-w-lg">
        <div className="bg-white dark:bg-dark-surface rounded-card-lg shadow-xl border border-primary-teal/10 p-8">
          <div className="text-center mb-8">
            <div
              className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 ${
                score >= 60 ? 'bg-emerald-50 dark:bg-emerald-500/15' : 'bg-error/5'
              }`}
            >
              <span className={`text-3xl font-bold font-poppins ${score >= 60 ? 'text-emerald-600' : 'text-error'}`}>
                {score}%
              </span>
            </div>
            <h1 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-1">{gradeLabel}</h1>
            <p className="text-text-dark/60 dark:text-light-mint/70">{name}, here&apos;s your AI-graded breakdown:</p>
          </div>

          <div className="space-y-4 mb-8">
            {breakdown.map((part) => (
              <div key={part.label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-medium text-deep-teal dark:text-light-mint">{part.label}</span>
                  <span className={`font-bold ${part.score >= 70 ? 'text-emerald-600' : part.score >= 50 ? 'text-gold-accent' : 'text-error'}`}>
                    {part.score}/100
                  </span>
                </div>
                <div className="h-2 bg-bg-light dark:bg-dark-elevated rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      part.score >= 70 ? 'bg-primary-teal' : part.score >= 50 ? 'bg-gold-accent' : 'bg-error'
                    }`}
                    style={{ width: `${part.score}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="w-full text-center px-6 py-3.5 rounded-card bg-primary-teal text-white font-semibold hover:bg-light-mint transition-all duration-200 shadow-md"
            >
              Back to Examly
            </Link>
            <button
              onClick={() => {
                setStage('instructions');
                setCurrent(0);
                setScore(0);
              }}
              className="w-full px-6 py-3 rounded-card border-2 border-primary-teal text-primary-teal font-semibold hover:bg-primary-teal/5 transition-all duration-200"
            >
              Take Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
