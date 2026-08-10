import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="h-8 w-64 rounded bg-primary-teal/10 animate-pulse"></div>
        <div className="h-4 w-96 max-w-full rounded bg-primary-teal/5 animate-pulse"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-36 rounded-card-lg bg-white dark:bg-dark-surface border border-primary-teal/10 animate-pulse"></div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-72 rounded-card-lg bg-white dark:bg-dark-surface border border-primary-teal/10 animate-pulse"></div>
        <div className="h-72 rounded-card-lg bg-deep-teal animate-pulse"></div>
      </div>
    </div>
  );
}
