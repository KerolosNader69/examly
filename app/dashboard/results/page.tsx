'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getExams, getResults, StudentResult, saveExams } from '@/lib/exams';
import Breadcrumbs from '@/components/dashboard/Breadcrumbs';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

export default function RecordingsPage() {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<StudentResult | null>(null);
  const [overrideScore, setOverrideScore] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    setResults(getResults());
  }, []);

  // Generate a synthesized audio tone data URL so standard HTML5 audio player works natively without external files
  const sampleAudioUrl = useMemoAudioUrl();

  const handleSelectSubmission = (result: StudentResult) => {
    setSelectedResult(result);
    setOverrideScore(result.score);
    setIsPlaying(false);
  };

  const handleSaveOverride = () => {
    if (!selectedResult) return;
    const updatedResults = results.map((r) =>
      r.id === selectedResult.id ? { ...r, score: Number(overrideScore) } : r
    );
    setResults(updatedResults);
    setSelectedResult({ ...selectedResult, score: Number(overrideScore) });
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('examly_results', JSON.stringify(updatedResults));
    }
    toast('Score override saved successfully!', 'success');
  };

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs />
        <h1 className="text-2xl lg:text-3xl font-bold font-poppins text-deep-teal dark:text-white mt-1">Recordings &amp; Reviews</h1>
        <p className="text-text-dark/60 dark:text-light-mint/70">Listen to audio recordings, inspect transcriptions, and apply score overrides.</p>
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
              <p className="text-text-dark/50 dark:text-light-mint/50">No recordings available yet.</p>
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
                      {((r as any).flagged_reason || (r as any).flaggedReason) && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-300 text-rose-700 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1 shadow-sm">
                          <span>⚠️</span> Flagged (Tab Switch)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-dark/50 dark:text-light-mint/50">
                      Submitted: {new Date(r.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs font-medium text-text-dark/50 dark:text-light-mint/50 block">AI Score</span>
                    <span className="text-lg font-bold text-primary-teal">{r.score}/100</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSubmission(r);
                    }}
                    className="px-4 py-2 rounded-card bg-primary-teal text-white text-xs font-semibold hover:bg-light-mint transition-colors"
                  >
                    Review Submission
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Review Modal / Side Panel */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-deep-teal/70 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-white dark:bg-dark-surface w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-primary-teal/20 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-deep-teal text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold font-poppins">{selectedResult.name} — Submission Review</h3>
                <p className="text-xs text-light-mint/70">Recorded on {new Date(selectedResult.submittedAt).toLocaleString()}</p>
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
              {/* Media Player Section */}
              {(() => {
                const recUrl = (selectedResult as any).recording_url || (selectedResult as any).recordingUrl;
                const isVideoRecording =
                  recUrl?.includes('.webm') ||
                  recUrl?.includes('.mp4') ||
                  (selectedResult as any).type === 'video' ||
                  (selectedResult as any).type === 'audio_video';

                return (
                  <div className="p-5 rounded-card-lg bg-deep-teal/5 dark:bg-dark-elevated border border-primary-teal/20 space-y-3">
                    <h4 className="text-sm font-bold text-deep-teal dark:text-light-mint flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isVideoRecording ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        )}
                      </svg>
                      {isVideoRecording ? 'Video & Audio Recording Player' : 'Audio Player Recording'}
                    </h4>
                    <div className="bg-white dark:bg-dark-surface p-4 rounded-card border border-gray-200 dark:border-light-mint/15">
                      {isVideoRecording ? (
                        <video
                          controls
                          src={recUrl || sampleAudioUrl}
                          className="w-full max-h-80 rounded-xl object-contain bg-black shadow-lg"
                        />
                      ) : (
                        <audio
                          ref={audioRef}
                          controls
                          src={recUrl || sampleAudioUrl}
                          className="w-full focus:outline-none"
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                        />
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Grid: Transcript & AI Evaluation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Transcript Panel */}
                <div className="p-5 rounded-card-lg border border-gray-200 dark:border-light-mint/15 bg-bg-light/50 dark:bg-dark-elevated/50 space-y-3">
                  <h4 className="text-sm font-bold text-deep-teal dark:text-white uppercase tracking-wider">
                    Automated Transcript
                  </h4>
                  <div className="text-xs text-text-dark/80 dark:text-light-mint/80 leading-relaxed max-h-48 overflow-y-auto p-3 bg-white dark:bg-dark-surface rounded border border-gray-100 dark:border-light-mint/10 italic">
                    &quot;Good morning. In response to question 1, I believe photosynthesis is essential because plants convert solar energy into chemical energy using chlorophyll. This produces oxygen for the atmosphere and forms the basis of the terrestrial food chain...&quot;
                  </div>
                </div>

                {/* AI Evaluation Breakdown */}
                <div className="p-5 rounded-card-lg border border-gray-200 dark:border-light-mint/15 bg-bg-light/50 dark:bg-dark-elevated/50 space-y-3">
                  <h4 className="text-sm font-bold text-deep-teal dark:text-white uppercase tracking-wider">
                    AI Evaluation Breakdown
                  </h4>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-text-dark/70 dark:text-light-mint/70">Question 1 Score:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">90 / 100</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-dark/70 dark:text-light-mint/70">Question 2 Score:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">85 / 100</span>
                    </div>
                    <div className="pt-2 border-t border-gray-200 dark:border-light-mint/15 flex justify-between items-center font-bold text-sm text-deep-teal dark:text-white">
                      <span>Overall AI Calculated Score:</span>
                      <span className="text-primary-teal">{selectedResult.score}%</span>
                    </div>
                  </div>
                </div>
              </div>

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

// Helper hook to create a 3-second generated audio WAV Blob URL safely in browser
function useMemoAudioUrl() {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    try {
      const sampleRate = 8000;
      const numSamples = sampleRate * 2; // 2 seconds audio tone
      const buffer = new Uint8Array(44 + numSamples);
      
      // Basic WAV Header setup
      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) buffer[offset + i] = str.charCodeAt(i);
      };
      writeString(0, 'RIFF');
      new DataView(buffer.buffer).setUint32(4, 36 + numSamples, true);
      writeString(8, 'WAVEfmt ');
      new DataView(buffer.buffer).setUint32(16, 16, true); // Subchunk1Size
      new DataView(buffer.buffer).setUint16(20, 1, true);  // AudioFormat (PCM)
      new DataView(buffer.buffer).setUint16(22, 1, true);  // NumChannels (1)
      new DataView(buffer.buffer).setUint32(24, sampleRate, true);
      new DataView(buffer.buffer).setUint32(28, sampleRate, true);
      new DataView(buffer.buffer).setUint16(32, 1, true);  // BlockAlign
      new DataView(buffer.buffer).setUint16(34, 8, true);  // BitsPerSample
      writeString(36, 'data');
      new DataView(buffer.buffer).setUint32(40, numSamples, true);

      // Generate sine wave samples
      for (let i = 0; i < numSamples; i++) {
        buffer[44 + i] = Math.floor(128 + 63 * Math.sin((i / sampleRate) * 440 * 2 * Math.PI));
      }

      const blob = new Blob([buffer], { type: 'audio/wav' });
      const objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } catch {
      /* ignore audio synth fallback */
    }
  }, []);
  return url;
}
