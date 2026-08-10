import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto rounded-full border-4 border-primary-teal/30 border-t-primary-teal animate-spin mb-4"></div>
        <p className="text-text-dark/60 dark:text-light-mint/70 text-sm">Loading...</p>
      </div>
    </div>
  );
}
