'use client';

import React, { useEffect, useRef, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

/**
 * Plays one stored recording through a short-lived signed URL (teacher-only route).
 *
 * MediaRecorder webm files have no duration in their header, so browsers report
 * duration = Infinity and the seek bar doesn't work. Seeking far past the end once
 * makes the browser scan the file and learn the real duration; then we jump back.
 */
export default function RecordingPlayer({ sessionId, questionId, video }: { sessionId: string; questionId?: string; video: boolean }) {
  const key = `${sessionId}:${questionId ?? ''}`;
  const [state, setState] = useState<{ key: string; url: string | null; error: boolean } | null>(null);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const current = state && state.key === key ? state : null;
  const url = current?.url ?? null;
  const error = current?.error ?? false;

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ sessionId, ...(questionId ? { questionId } : {}) });
    authedFetch(`/api/teacher/recording-url?${qs.toString()}`)
      .then(async (res) => {
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setState({ key, url: data?.url ?? null, error: !data?.url });
      })
      .catch(() => {
        if (!cancelled) setState({ key, url: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [key, sessionId, questionId]);

  const fixDuration = () => {
    const el = mediaRef.current;
    if (!el || Number.isFinite(el.duration)) return;
    const restore = () => {
      el.removeEventListener('timeupdate', restore);
      el.currentTime = 0;
    };
    el.addEventListener('timeupdate', restore);
    el.currentTime = 1e101;
  };

  if (error) return <p className="text-xs text-text-dark/60 dark:text-light-mint/70">Recording could not be loaded (it may not have finished uploading).</p>;
  if (!url) return <p className="text-xs text-text-dark/60 dark:text-light-mint/70">Loading recording…</p>;
  return video ? (
    <video
      ref={(el) => {
        mediaRef.current = el;
      }}
      controls
      preload="metadata"
      src={url}
      onLoadedMetadata={fixDuration}
      className="w-full max-h-72 rounded-xl object-contain bg-black"
    />
  ) : (
    <audio
      ref={(el) => {
        mediaRef.current = el;
      }}
      controls
      preload="metadata"
      src={url}
      onLoadedMetadata={fixDuration}
      className="w-full"
    />
  );
}
