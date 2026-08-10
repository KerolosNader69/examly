import React from 'react';
import Card from '../ui/Card';
import Link from 'next/link';
import ScrollReveal from '../ui/ScrollReveal';

const plans = [
  {
    name: 'Free',
    description: 'Perfect for trying out Examly',
    features: [
      'Up to 10 exams per month',
      'Basic AI grading',
      'Single teacher account',
      'Email support',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Basic',
    description: 'For individual teachers',
    features: [
      'Unlimited exams',
      'Advanced AI grading',
      'Detailed analytics',
      'Priority support',
      'Custom rubrics',
    ],
    cta: 'Learn More',
    highlighted: true,
  },
  {
    name: 'Pro',
    description: 'For schools and institutions',
    features: [
      'Everything in Basic',
      'Multiple teacher accounts',
      'Admin dashboard',
      'API access',
      'Dedicated support',
      'Custom integration',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="bg-white py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-poppins text-deep-teal mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-text-dark/70 max-w-2xl mx-auto">
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
                    <h3 className="text-2xl font-bold font-poppins text-deep-teal mb-2">
                      {plan.name}
                    </h3>
                    <p className="text-text-dark/70">
                      {plan.description}
                    </p>
                  </div>

                  <div className="py-4">
                    <p className="text-3xl font-bold font-poppins text-primary-teal">
                      Pricing Coming Soon
                    </p>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start">
                        <svg className="w-5 h-5 text-primary-teal mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-text-dark/80">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link 
                    href="/pricing" 
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
      </div>
    </section>
  );
}
