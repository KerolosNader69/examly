'use client';

import React, { useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', topic: 'General question', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.email.trim()) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email';
    if (!form.message.trim()) next.message = 'Message is required';
    else if (form.message.trim().length < 10) next.message = 'Please provide a bit more detail';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSent(true);
  };

  return (
    <>
      <Header />
      <main className="bg-bg-light dark:bg-deep-teal">
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-light-mint/20 border border-primary-teal/30 mb-6">
                <span className="text-sm font-medium text-primary-teal">Contact</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold font-poppins text-deep-teal dark:text-white mb-4">Get in Touch</h1>
              <p className="text-lg text-text-dark/70 dark:text-light-mint/70 max-w-2xl mx-auto">
                Have a question or want a custom plan for your institution? We&apos;d love to hear from you.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Contact info */}
              <div className="space-y-6">
                {[
                  {
                    title: 'Email Us',
                    value: 'hello@examly.ai',
                    desc: 'For general questions and support',
                    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
                  },
                  {
                    title: 'Sales',
                    value: 'sales@examly.ai',
                    desc: 'For school and institution plans',
                    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                  },
                  {
                    title: 'Support Hours',
                    value: 'Mon–Fri, 9am–6pm',
                    desc: 'Average response time: under 4 hours',
                    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
                    <div className="w-12 h-12 rounded-card bg-primary-teal/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-primary-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-text-dark/50 dark:text-light-mint/50">{item.title}</p>
                      <p className="font-semibold text-deep-teal dark:text-light-mint">{item.value}</p>
                      <p className="text-sm text-text-dark/60 dark:text-light-mint/60 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}

                <div className="bg-deep-teal rounded-card-lg p-6 text-white">
                  <h3 className="font-semibold font-poppins mb-2">Prefer a demo first?</h3>
                  <p className="text-sm text-light-mint/80 mb-4">
                    Book a 15-minute walkthrough with our team to see Examly in action for your classroom.
                  </p>
                  <button className="px-5 py-2.5 rounded-card bg-primary-teal text-white text-sm font-semibold hover:bg-light-mint transition-colors">
                    Book a Demo
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-8">
                {sent ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center mb-6">
                      <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-2">Message sent!</h2>
                    <p className="text-text-dark/60 dark:text-light-mint/70 mb-6">
                      Thanks for reaching out, {form.name.split(' ')[0] || 'friend'}. We&apos;ll get back to you within 24 hours.
                    </p>
                    <button
                      onClick={() => {
                        setSent(false);
                        setForm({ name: '', email: '', topic: 'General question', message: '' });
                      }}
                      className="px-6 py-3 rounded-card border-2 border-primary-teal text-primary-teal font-semibold hover:bg-primary-teal/5 transition-colors"
                    >
                      Send Another
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                    <h2 className="text-xl font-semibold font-poppins text-deep-teal dark:text-white mb-2">Send us a message</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <Input
                        name="name"
                        label="Full name"
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
                      name="topic"
                      label="Topic"
                      value={form.topic}
                      onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    >
                      {['General question', 'Sales & pricing', 'Technical support', 'Partnership', 'Feedback'].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                    <Textarea
                      name="message"
                      label="Message"
                      placeholder="Tell us how we can help..."
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      error={errors.message}
                      className="min-h-36"
                    />
                    <button
                      type="submit"
                      className="w-full px-6 py-3.5 rounded-card bg-primary-teal text-white font-semibold text-lg hover:bg-light-mint transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      Send Message
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
