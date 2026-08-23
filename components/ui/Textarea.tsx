import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export default function Textarea({ label, error, className = '', id, ...props }: TextareaProps) {
  const inputId = id || props.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-deep-teal dark:text-light-mint mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`w-full px-4 py-3 rounded-card border bg-white text-text-dark placeholder:text-text-dark/40 outline-none transition-all duration-200 focus:ring-2 focus:ring-primary-teal/30 min-h-24 resize-y dark:bg-dark-surface dark:text-light-mint dark:placeholder:text-light-mint/30 ${
          error ? 'border-error' : 'border-gray-200 hover:border-primary-teal/40 dark:border-light-mint/15 dark:hover:border-primary-teal/50'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-error">{error}</p>}
    </div>
  );
}
