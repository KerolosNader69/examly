'use client';

import React, { useState } from 'react';

export default function UniversityDemoForm() {
  const [form, setForm] = useState({
    name: '',
    university: '',
    role: '',
    department: '',
    email: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.email || !form.university) {
      setError('Please fill in your name, university, and email address.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          subject: `University Demo Request - ${form.university}`,
          message: `University: ${form.university}\nRole: ${form.role}\nDepartment: ${form.department}\nMessage: ${form.message}`,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit request');
      }

      setSubmitted(true);
    } catch {
      setError('Something went wrong submitting your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white dark:bg-dark-surface p-8 rounded-card-lg border border-primary-teal/20 text-center space-y-4">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">✓</div>
        <h3 className="text-xl font-bold text-deep-teal dark:text-white font-poppins">Demo Request Received</h3>
        <p className="text-sm text-text-dark/70 dark:text-light-mint/70 max-w-md mx-auto">
          Thank you, <span className="font-semibold text-deep-teal dark:text-light-mint">{form.name}</span>. Our university team will contact you shortly at <span className="font-semibold">{form.email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-dark-surface p-8 rounded-card-lg border border-primary-teal/20 shadow-md space-y-4 text-left">
      <h3 className="text-xl font-bold font-poppins text-deep-teal dark:text-white mb-2">Request a University Demo</h3>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-text-dark/80 dark:text-light-mint mb-1">Full Name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Dr. Sarah Jenkins"
            className="w-full px-3 py-2 text-sm rounded-card border border-gray-300 dark:border-primary-teal/30 bg-white dark:bg-deep-teal text-text-dark dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-dark/80 dark:text-light-mint mb-1">University / Institution *</label>
          <input
            type="text"
            required
            value={form.university}
            onChange={(e) => setForm({ ...form, university: e.target.value })}
            placeholder="State University"
            className="w-full px-3 py-2 text-sm rounded-card border border-gray-300 dark:border-primary-teal/30 bg-white dark:bg-deep-teal text-text-dark dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-text-dark/80 dark:text-light-mint mb-1">Academic Role</label>
          <input
            type="text"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            placeholder="Department Chair / Professor"
            className="w-full px-3 py-2 text-sm rounded-card border border-gray-300 dark:border-primary-teal/30 bg-white dark:bg-deep-teal text-text-dark dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-dark/80 dark:text-light-mint mb-1">Department</label>
          <input
            type="text"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            placeholder="Computer Science / Medicine"
            className="w-full px-3 py-2 text-sm rounded-card border border-gray-300 dark:border-primary-teal/30 bg-white dark:bg-deep-teal text-text-dark dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-dark/80 dark:text-light-mint mb-1">Institutional Email *</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="s.jenkins@university.edu"
          className="w-full px-3 py-2 text-sm rounded-card border border-gray-300 dark:border-primary-teal/30 bg-white dark:bg-deep-teal text-text-dark dark:text-white"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-dark/80 dark:text-light-mint mb-1">Message / Assessment Needs</label>
        <textarea
          rows={3}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Tell us about your cohort size or viva examination requirements..."
          className="w-full px-3 py-2 text-sm rounded-card border border-gray-300 dark:border-primary-teal/30 bg-white dark:bg-deep-teal text-text-dark dark:text-white"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-primary-teal text-white font-semibold text-sm rounded-card hover:bg-light-mint transition-colors shadow-md disabled:opacity-50"
      >
        {submitting ? 'Submitting Request...' : 'Submit University Demo Request'}
      </button>
    </form>
  );
}
