'use client';

import React, { useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: 'General', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Full name is required';
    if (!form.email.trim()) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address';
    if (!form.message.trim()) next.message = 'Message is required';
    else if (form.message.trim().length < 10) next.message = 'Please provide a bit more detail';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validate()) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setSent(true);
    } catch (err: any) {
      setErrors({ general: err?.message || 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="bg-bg-light dark:bg-deep-teal min-h-screen py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-teal/10 border border-primary-teal/30 mb-4">
              <span className="text-xs font-semibold text-primary-teal uppercase tracking-wider">Support &amp; Contact</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-poppins text-deep-teal dark:text-white mb-3">
              We&apos;re here to help
            </h1>
            <p className="text-base sm:text-lg text-text-dark/70 dark:text-light-mint/70 max-w-xl mx-auto">
              Have questions about Examly, need technical assistance, or exploring institution plans? Reach out anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar Support Info */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-dark-surface p-6 rounded-card-lg border border-primary-teal/10 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-card bg-primary-teal/10 text-primary-teal flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-deep-teal dark:text-white text-base">Direct Email Support</h3>
                  <p className="text-xs text-text-dark/60 dark:text-light-mint/70 mt-1">
                    Send us an email directly at:
                  </p>
                  <a href="mailto:support@examly.site" className="text-sm font-semibold text-primary-teal hover:underline block mt-0.5">
                    support@examly.site
                  </a>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-surface p-6 rounded-card-lg border border-primary-teal/10 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-card bg-primary-teal/10 text-primary-teal flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-deep-teal dark:text-white text-base">Response Time</h3>
                  <p className="text-xs text-text-dark/60 dark:text-light-mint/70 mt-1">
                    We typically respond to all support requests in <span className="font-bold text-deep-teal dark:text-light-mint">under 4 hours</span> during business hours (Mon–Fri, 9am–6pm EST).
                  </p>
                </div>
              </div>
            </div>

            {/* Main Contact Form or Success State */}
            <div className="lg:col-span-2 bg-white dark:bg-dark-surface p-8 rounded-card-lg border border-primary-teal/10 shadow-sm">
              {sent ? (
                /* Success State Confirmation */
                <div className="text-center py-12 space-y-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-2">
                      Message Sent Successfully!
                    </h2>
                    <p className="text-sm text-text-dark/60 dark:text-light-mint/70 max-w-md mx-auto">
                      Thank you for contacting us, <span className="font-semibold text-deep-teal dark:text-light-mint">{form.name}</span>. Our team has received your inquiry regarding <span className="font-medium">{form.subject}</span> and will reply shortly.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSent(false);
                      setForm({ name: '', email: '', subject: 'General', message: '' });
                    }}
                    className="px-6 py-3 rounded-card bg-primary-teal text-white font-semibold text-sm hover:bg-light-mint transition-colors shadow-md"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                /* Form Fields */
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <h2 className="text-xl font-bold font-poppins text-deep-teal dark:text-white">Send us a message</h2>

                  {errors.general && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-card text-rose-600 dark:text-rose-400 text-xs font-medium">
                      {errors.general}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Input
                      name="name"
                      label="Full Name"
                      placeholder="Jane Doe"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      error={errors.name}
                    />

                    <Input
                      name="email"
                      type="email"
                      label="Email address"
                      placeholder="you@school.edu"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      error={errors.email}
                    />
                  </div>

                  <Select
                    name="subject"
                    label="Subject"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Billing &amp; Subscription">Billing &amp; Subscription</option>
                    <option value="Institution Plan">Institution Plan</option>
                  </Select>

                  <Textarea
                    name="message"
                    label="Message"
                    placeholder="How can our team help you?"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    error={errors.message}
                    className="min-h-32"
                  />

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-6 rounded-card bg-primary-teal text-white font-semibold text-base hover:bg-light-mint transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      'Send Message'
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
