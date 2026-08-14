import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export default function Input({ label, error, icon, className = '', id, ...props }: InputProps) {
  const inputId = id || props.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-deep-teal mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-teal opacity-80 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={`w-full px-4 py-3 rounded-card border bg-white text-text-dark placeholder:text-text-dark/40 outline-none transition-all duration-200 focus:ring-2 focus:ring-primary-teal/30 dark:bg-dark-surface dark:text-light-mint dark:placeholder:text-light-mint/30 ${
            icon ? 'pl-10' : ''
          } ${error ? 'border-error' : 'border-gray-200 hover:border-primary-teal/40 dark:border-light-mint/15 dark:hover:border-primary-teal/50'} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-sm text-error">{error}</p>}
    </div>
  );
}
