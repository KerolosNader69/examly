'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { authedFetch } from '@/lib/authedFetch';
import { useToast } from '@/components/ui/Toast';

interface Status {
  eligible: boolean;
  linked: boolean;
  linkedAt: string | null;
  botUsername: string | null;
}

interface CodeInfo {
  code: string;
  expiresAt: string;
  deepLink: string | null;
}

/**
 * Settings card: connect / disconnect the Examly Telegram bot (Pro plan).
 * Renders nothing while the feature flag is off (the API answers 404).
 */
export default function TelegramConnect() {
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [codeInfo, setCodeInfo] = useState<CodeInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const fetchStatus = useCallback(async (): Promise<Status | null> => {
    try {
      const res = await authedFetch('/api/teacher/telegram');
      return res.ok ? ((await res.json()) as Status) : null;
    } catch {
      return null;
    }
  }, []);

  const load = useCallback(async () => setStatus(await fetchStatus()), [fetchStatus]);

  useEffect(() => {
    let active = true;
    fetchStatus().then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (!codeInfo) return;
    const tick = () => {
      const left = Math.max(0, Math.round((Date.parse(codeInfo.expiresAt) - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setCodeInfo(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [codeInfo]);

  if (!status) return null;

  const connect = async () => {
    setBusy(true);
    try {
      const res = await authedFetch('/api/teacher/telegram', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(body.error || 'Could not create a code.', 'error');
        return;
      }
      setCodeInfo(body as CodeInfo);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      const res = await authedFetch('/api/teacher/telegram', { method: 'DELETE' });
      if (!res.ok) {
        toast('Could not disconnect Telegram. Please try again.', 'error');
        return;
      }
      setCodeInfo(null);
      toast('Telegram disconnected.', 'success');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <section className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6 sm:p-8 space-y-5">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">Telegram Bot</h2>
          <p className="text-sm text-text-dark/60 dark:text-light-mint/70">
            Send a PDF of multiple-choice questions to the Examly bot on Telegram and get a ready exam back.
          </p>
        </div>
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gold-accent/10 text-gold-accent border border-gold-accent/30 whitespace-nowrap">
          Pro
        </span>
      </div>

      {!status.eligible && !status.linked && (
        <p className="text-sm text-text-dark/70 dark:text-light-mint/70">
          The Telegram bot is part of the Pro plan.{' '}
          <Link href="/dashboard/billing" className="text-primary-teal font-semibold underline">
            See plans
          </Link>
        </p>
      )}

      {status.linked && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-text-dark/80 dark:text-light-mint/80">
            Connected{status.linkedAt ? ` since ${new Date(status.linkedAt).toLocaleDateString()}` : ''}.
            {!status.eligible && ' Your plan is not Pro, so the bot will not create exams until you upgrade.'}
          </p>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="px-5 py-2 rounded-card border border-red-300 text-red-600 dark:text-red-400 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      )}

      {status.eligible && !status.linked && (
        <div className="space-y-4">
          {!codeInfo ? (
            <button
              type="button"
              onClick={connect}
              disabled={busy}
              className="px-6 py-2.5 rounded-card bg-primary-teal hover:bg-primary-teal/90 text-white font-semibold text-sm shadow-md disabled:opacity-50"
            >
              Connect Telegram
            </button>
          ) : (
            <div className="p-4 rounded-card bg-primary-teal/5 border border-primary-teal/20 space-y-3">
              <p className="text-sm text-text-dark/80 dark:text-light-mint/80">
                Open {status.botUsername ? <strong>@{status.botUsername}</strong> : 'the Examly bot'} in Telegram and send:
              </p>
              <p className="font-mono text-lg font-bold text-deep-teal dark:text-white select-all break-all">/start {codeInfo.code}</p>
              <div className="flex flex-wrap items-center gap-3">
                {codeInfo.deepLink && (
                  <a
                    href={codeInfo.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-card bg-primary-teal text-white font-semibold text-sm"
                  >
                    Open in Telegram
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`/start ${codeInfo.code}`).then(
                      () => toast('Copied.', 'success'),
                      () => undefined
                    );
                  }}
                  className="px-4 py-2 rounded-card border border-primary-teal/30 text-primary-teal font-semibold text-sm"
                >
                  Copy
                </button>
                <span className="text-xs text-text-dark/60 dark:text-light-mint/60">
                  One-time code, expires in {mm}:{ss}.
                </span>
                <button type="button" onClick={load} className="text-xs text-primary-teal underline">
                  I sent it, refresh
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
