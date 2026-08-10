'use client';

import React from 'react';

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, pageCount, total, pageSize, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages: (number | '...')[] = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  const buttonClass =
    'w-9 h-9 rounded-card flex items-center justify-center text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      <p className="text-sm text-text-dark/50 dark:text-light-mint/50">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className={`${buttonClass} text-text-dark/60 hover:bg-primary-teal/10 dark:text-light-mint/60`}
          aria-label="Previous page"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="w-9 h-9 flex items-center justify-center text-text-dark/40 dark:text-light-mint/40">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`${buttonClass} ${
                p === page
                  ? 'bg-primary-teal text-white shadow-md'
                  : 'text-text-dark/60 hover:bg-primary-teal/10 dark:text-light-mint/60'
              }`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          className={`${buttonClass} text-text-dark/60 hover:bg-primary-teal/10 dark:text-light-mint/60`}
          aria-label="Next page"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
