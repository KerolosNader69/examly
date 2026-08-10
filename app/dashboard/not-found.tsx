import React from 'react';
import NotFoundState from '@/components/ui/NotFoundState';

export default function DashboardNotFound() {
  return (
    <NotFoundState
      title="Exam not found"
      message="This exam may have been deleted, or the link is incorrect."
      backHref="/dashboard/exams"
      backLabel="Back to exams"
    />
  );
}
