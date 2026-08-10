import React from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Card from '@/components/ui/Card';
import ScrollReveal from '@/components/ui/ScrollReveal';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing - Examly',
  description: 'Simple, transparent pricing for AI-powered oral exams. Free to start, affordable to scale.',
};

const plans = [
  {
    name: 'Free',
    description: 'Perfect for trying out Examly',
    price: '$0',
    period: 'forever',
    features: ['Up to 10 exams per month', 'Basic AI grading', 'Single teacher account', 'Email support'],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Basic',
    description: 'For individual teachers',
    price: '$19',
    period: '/ month',
    features: ['Unlimited exams', 'Advanced AI grading', 'Detailed analytics', 'Priority support', 'Custom rubrics'],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Pro',
    description: 'For schools and institutions',
    price: 'Custom',
    period: '',
    features: ['Everything in Basic', 'Multiple teacher accounts', 'Admin dashboard', 'API access', 'Dedicated support', 'Custom integration'],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <>
      <Header />
      <main>
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <ScrollReveal>
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-light-mint/20 border border-primary-teal/30 mb-6">
                  <span className="text-sm font-medium text-primary-teal">Pricing</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold font-poppins text-deep-teal dark:text-white mb-4">
                  Simple, Transparent Pricing
                </h1>
                <p className="text-lg text-text-dark/70 dark:text-light-mint/70 max-w-2xl mx-auto">
                  Choose the plan that fits your needs. Upgrade or downgrade anytime.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans.map((plan, index) => (
                <ScrollReveal key={index}>
                  <Card
                    hover={false}
                    className={`relative h-full ${
                      plan.highlighted
                        ? 'ring-2 ring-primary-teal transform md:-translate-y-2 shadow-xl'
                        : ''
                    }`}
                  >
                    {plan.highlighted && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <span className="bg-primary-teal text-white px-4 py-1 rounded-full text-sm font-semibold">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold font-poppins text-deep-teal dark:text-white mb-2">{plan.name}</h2>
                        <p className="text-text-dark/70 dark:text-light-mint/70">{plan.description}</p>
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold font-poppins text-primary-teal">{plan.price}</span>
                        {plan.period && <span className="text-text-dark/50 dark:text-light-mint/50">{plan.period}</span>}
                      </div>

                      <ul className="space-y-3">
                        {plan.features.map((feature, fIndex) => (
                          <li key={fIndex} className="flex items-start">
                            <svg className="w-5 h-5 text-primary-teal mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-text-dark/80 dark:text-light-mint/80">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Link
                        href="/signup"
                        className={`block w-full text-center px-6 py-3 rounded-card font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-100 ${
                          plan.highlighted
                            ? 'bg-primary-teal text-white hover:bg-light-mint'
                            : 'bg-transparent border-2 border-primary-teal text-primary-teal hover:bg-primary-teal hover:text-white'
                        }`}
                      >
                        {plan.cta}
                      </Link>
                    </div>
                  </Card>
                </ScrollReveal>
              ))}
            </div>

            {/* FAQ */}
            <div className="max-w-3xl mx-auto mt-24">
              <h2 className="text-3xl font-bold font-poppins text-deep-teal dark:text-white text-center mb-10">
                Frequently Asked Questions
              </h2>
              <div className="space-y-4">
                {[
                  {
                    q: 'Do I need a credit card for the free plan?',
                    a: 'No. The free plan is completely free and requires no payment details. Start creating exams right away.',
                  },
                  {
                    q: 'Can I switch plans at any time?',
                    a: 'Absolutely. You can upgrade or downgrade anytime. Changes are prorated automatically on your next billing cycle.',
                  },
                  {
                    q: 'Is there a discount for schools?',
                    a: 'Yes! The Pro plan is designed for schools and institutions with custom volume pricing. Contact our sales team for a quote.',
                  },
                  {
                    q: 'What happens when I exceed my exam limit?',
                    a: 'You will be notified and can either wait for your monthly reset or upgrade to Basic for unlimited exams.',
                  },
                ].map((faq, i) => (
                  <ScrollReveal key={i}>
                    <div className="bg-white dark:bg-dark-surface rounded-card-lg border border-primary-teal/10 shadow-sm p-6">
                      <h3 className="font-semibold font-poppins text-deep-teal dark:text-white mb-2">{faq.q}</h3>
                      <p className="text-text-dark/70 dark:text-light-mint/70">{faq.a}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-24 bg-deep-teal rounded-card-lg p-10 md:p-16 text-center text-white relative overflow-hidden">
              <div className="absolute inset-0 hero-pattern opacity-30"></div>
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold font-poppins mb-4">Ready to transform your assessments?</h2>
                <p className="text-light-mint/80 max-w-xl mx-auto mb-8">
                  Join thousands of educators who have already made the switch to AI-powered oral exams.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-card bg-primary-teal text-white font-semibold text-lg hover:bg-light-mint transition-all duration-200 shadow-lg"
                >
                  Get Started Free
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
