import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'teal' | 'mint';
  hover?: boolean;
}

export default function Card({ children, className = '', variant = 'default', hover = true }: CardProps) {
  const variants = {
    default: 'bg-white',
    teal: 'bg-primary-teal/10',
    mint: 'bg-light-mint/20',
  };

  const hoverStyles = hover ? 'transition-all duration-200 hover:-translate-y-1 hover:shadow-xl' : '';

  return (
    <div className={`rounded-card-lg p-6 shadow-sm ${variants[variant]} ${hoverStyles} ${className}`}>
      {children}
    </div>
  );
}
