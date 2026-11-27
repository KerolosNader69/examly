'use client';

/**
 * Live captions for the video exam room, from the browser's own speech recognition.
 *
 * DISPLAY ONLY: the text lives in React state of this component and is never sent to our
 * server, stored, or graded. It does not touch the exam's MediaStream / MediaRecorders and
 * never calls getUserMedia (the recognizer opens its own audio input inside the browser).
 * Every call is wrapped so a failure here can never break the exam: worst case the
 * caption box is hidden.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  appendCaption,
  captionsAllowedOnDevice,
  classifySpeechError,
  nextRestart,
  splitResults,
  type RestartState,
  type ResultListLike,
} from '@/lib/liveCaptions';

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((e: { resultIndex: number; results: ResultListLike }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  try {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  } catch {
    return null;
  }
}

function detectSupport(): boolean {
  try {
    return captionsAllowedOnDevice({
      hasApi: recognitionCtor() !== null,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    });
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

export type CaptionStatus = 'unsupported' | 'blocked' | 'stalled' | 'ready';

interface Options {
  /** Recognize now (recording, captions on, nothing on top of the room). */
  active: boolean;
  /** BCP-47 tag (lib/liveCaptions captionLangFor), or null = no captions for this exam. */
  lang: string | null;
  /** Changes for each new recording (new question / re-record): clears the text. */
  resetKey: string;
  /**
   * Called with true just before the FIRST start() of the page (some browsers ask for
   * permission then, which takes focus away), and with false once that is over.
   */
  onPermissionWindow?: (open: boolean) => void;
}

export function useLiveCaptions({ active, lang, resetKey, onPermissionWindow }: Options) {
  const supported = useSyncExternalStore(noopSubscribe, detectSupport, () => false);
  const [blocked, setBlocked] = useState(false);
  // Text is tagged with the recording it belongs to, so a new key shows an empty box
  // without clearing state in an effect.
  const [captions, setCaptions] = useState<{ key: string; final: string; interim: string; stalled: boolean }>({
    key: '',
    final: '',
    interim: '',
    stalled: false,
  });
  const firstStartRef = useRef(true);
  const permissionCbRef = useRef(onPermissionWindow);
  useEffect(() => {
    permissionCbRef.current = onPermissionWindow;
  });

  useEffect(() => {
    if (!active || !lang || !supported || blocked) return;
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const Recognition: RecognitionCtor = Ctor;

    let stopped = false;
    let rec: RecognitionLike | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let permissionTimer: ReturnType<typeof setTimeout> | null = null;
    let restart: RestartState = { fastFails: 0, total: 0 };
    let sessionStart = 0;
    let sessionFailed = false;

    const update = (fn: (c: { final: string; interim: string; stalled: boolean }) => Partial<{ final: string; interim: string; stalled: boolean }>) =>
      setCaptions((prev) => {
        const base = prev.key === resetKey ? prev : { key: resetKey, final: '', interim: '', stalled: false };
        return { ...base, ...fn(base) };
      });

    const closePermissionWindow = (delay: number) => {
      if (!permissionTimer) return;
      clearTimeout(permissionTimer);
      permissionTimer = setTimeout(() => {
        permissionTimer = null;
        try { permissionCbRef.current?.(false); } catch { /* ignore */ }
      }, delay);
    };

    const scheduleRestart = () => {
      if (stopped) return;
      const n = nextRestart(restart, Date.now() - sessionStart, sessionFailed);
      restart = n.state;
      if (n.delayMs === null) {
        update(() => ({ interim: '', stalled: true }));
        return;
      }
      timer = setTimeout(start, n.delayMs);
    };

    function start() {
      timer = null;
      if (stopped) return;
      sessionStart = Date.now();
      sessionFailed = false;
      try {
        const r = new Recognition();
        r.lang = lang!;
        r.continuous = true;
        r.interimResults = true;
        r.maxAlternatives = 1;
        r.onstart = () => closePermissionWindow(1500);
        r.onresult = (e) => {
          try {
            if (stopped) return;
            restart = { ...restart, fastFails: 0 };
            const { final, interim } = splitResults(e.results, e.resultIndex);
            update((c) => ({ final: final ? appendCaption(c.final, final) : c.final, interim: interim.slice(-300) }));
          } catch { /* ignore */ }
        };
        r.onerror = (e) => {
          try {
            closePermissionWindow(1500);
            const action = classifySpeechError(e?.error);
            if (action === 'disable') {
              stopped = true;
              setBlocked(true);
            } else if (action === 'backoff') {
              sessionFailed = true;
            }
          } catch { /* ignore */ }
        };
        r.onend = () => {
          if (rec === r) rec = null;
          try { update(() => ({ interim: '' })); } catch { /* ignore */ }
          scheduleRestart();
        };
        rec = r;
        if (firstStartRef.current) {
          firstStartRef.current = false;
          try { permissionCbRef.current?.(true); } catch { /* ignore */ }
          // Never keep the window open long: tab-switch detection must stay effective.
          permissionTimer = setTimeout(() => {
            permissionTimer = null;
            try { permissionCbRef.current?.(false); } catch { /* ignore */ }
          }, 10_000);
        }
        r.start();
      } catch {
        rec = null;
        sessionFailed = true;
        scheduleRestart();
      }
    }

    start();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (permissionTimer) {
        clearTimeout(permissionTimer);
        try { permissionCbRef.current?.(false); } catch { /* ignore */ }
      }
      const r = rec;
      rec = null;
      if (r) {
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
        r.onstart = null;
        try { r.abort(); } catch { /* ignore */ }
      }
      try {
        setCaptions((prev) => (prev.interim ? { ...prev, interim: '' } : prev));
      } catch { /* ignore */ }
    };
  }, [active, lang, supported, blocked, resetKey]);

  const current = captions.key === resetKey ? captions : { final: '', interim: '', stalled: false };
  const status: CaptionStatus = !supported || !lang ? 'unsupported' : blocked ? 'blocked' : current.stalled ? 'stalled' : 'ready';
  return { status, finalText: current.final, interimText: current.interim };
}
