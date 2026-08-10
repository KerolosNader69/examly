'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Crumb {
  href: string;
  label: string;
}

const segmentLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  exams: 'My Exams',
  new: 'New Exam',
  results: 'Results & Analytics',
};

export default function Breadcrumbs({ overrides = [] }: { overrides?: Crumb[] }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs: Crumb[] = [];
  let path = '';

  for (let i = 0; i < segments.length; i++) {
    path += `/${segments[i]}`;
    const segment = segments[i];

    let label = segmentLabels[segment];
    if (!label && /^\[.*\]$/.test(segment)) {
      label = 'Details';
    }
    if (!label) {
      label = segment.charAt(0).toUpperCase() + segment.slice(1);
    }
    crumbs.push({ href: path, label });
  }

  if (overrides.length > 0) {
    overrides.forEach((override, i) => {
      const idx = crumbs.length - overrides.length + i;
      if (crumbs[idx]) crumbs[idx] = { ...override, href: crumbs[idx].href };
    });
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex items-center flex-wrap gap-1.5 text-sm">
        <li>
          <Link href="/dashboard" className="text-text-dark/50 hover:text-primary-teal transition-colors dark:text-light-mint/50 dark:hover:text-primary-teal">
            Dashboard
          </Link>
        </li>
        {crumbs.slice(1).map((crumb, i) => {
          const isLast = i === crumbs.length - 2;
          return (
            <li key={crumb.href} className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-text-dark/30 dark:text-light-mint/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
              {isLast ? (
                <span className="font-medium text-text-dark dark:text-light-mint">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="text-text-dark/50 hover:text-primary-teal transition-colors dark:text-light-mint/50 dark:hover:text-primary-teal">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
