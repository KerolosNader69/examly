import React from 'react';
import NotFoundState from '@/components/ui/NotFoundState';

export default function NotFound() {
  return (
    <NotFoundState
      title="Page not found"
      message="Sorry, we couldn't find the page you're looking for. It may have been moved or deleted."
    />
  );
}
