import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: React.ReactNode;
}

export default function Select({ label, error, className = '', id, children, ...props }: SelectProps) {
  const inputId = id || props.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-deep-teal dark:text-light-mint mb-1.5">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={`w-full px-4 py-3 rounded-card border bg-white text-text-dark outline-none transition-all duration-200 focus:ring-2 focus:ring-primary-teal/30 appearance-none cursor-pointer dark:bg-dark-surface dark:text-light-mint ${
          error ? 'border-error' : 'border-gray-200 hover:border-primary-teal/40 dark:border-light-mint/15 dark:hover:border-primary-teal/50'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1.5 text-sm text-error">{error}</p>}
    </div>
  );
}
