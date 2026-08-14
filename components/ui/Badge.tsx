import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'teal' | 'gold' | 'gray' | 'green' | 'red';
}

const colors = {
  teal: 'bg-primary-teal/10 text-primary-teal dark:bg-primary-teal/20 dark:text-light-mint',
  gold: 'bg-gold-accent/15 text-gold-accent dark:bg-gold-accent/20 dark:text-gold-accent',
  gray: 'bg-gray-100 text-text-dark/60 dark:bg-white/10 dark:text-light-mint/60',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  red: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
};

export default function Badge({ children, color = 'teal' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color]}`}>
      {children}
    </span>
  );
}
