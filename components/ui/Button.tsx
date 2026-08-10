import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  children: React.ReactNode;
}

export default function Button({ 
  variant = 'primary', 
  children, 
  className = '', 
  ...props 
}: ButtonProps) {
  const baseStyles = 'px-6 py-3 rounded-card font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 hover:shadow-lg active:scale-100';
  
  const variants = {
    primary: 'bg-primary-teal text-white hover:bg-light-mint shadow-md',
    secondary: 'bg-transparent border-2 border-primary-teal text-primary-teal hover:bg-primary-teal hover:text-white shadow-sm',
    outline: 'bg-white border border-gray-300 text-text-dark hover:border-primary-teal hover:text-primary-teal shadow-sm dark:bg-dark-surface dark:border-light-mint/20 dark:text-light-mint dark:hover:border-primary-teal',
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
