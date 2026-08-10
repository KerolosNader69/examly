import React from 'react';
import Card from '../ui/Card';
import ScrollReveal from '../ui/ScrollReveal';

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'High School English Teacher',
    avatar: 'SJ',
    quote: 'Examly has completely transformed how I assess oral presentations. The AI grading is remarkably consistent, and I save hours every week.',
    rating: 5,
  },
  {
    name: 'Dr. Ahmed Hassan',
    role: 'University Professor',
    avatar: 'AH',
    quote: 'The analytics dashboard helps me identify which students need extra support. It\'s like having a teaching assistant that never sleeps.',
    rating: 5,
  },
  {
    name: 'Maria Rodriguez',
    role: 'Language Institute Director',
    avatar: 'MR',
    quote: 'We\'ve scaled our oral assessments across 500+ students without hiring additional staff. The ROI has been incredible.',
    rating: 5,
  },
];

export default function TestimonialsSection() {
  return (
    <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <ScrollReveal>
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-poppins text-deep-teal dark:text-white mb-4">
            Trusted by Educators Worldwide
          </h2>
          <p className="text-lg text-text-dark/70 dark:text-light-mint/70 max-w-2xl mx-auto">
            Join thousands of teachers who are already transforming their assessment process.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((testimonial, index) => (
          <ScrollReveal key={index}>
            <Card variant="mint">
              <div className="space-y-4">
                {/* Star Rating */}
                <div className="flex space-x-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-gold-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                {/* Quote */}
                <p className="text-text-dark/80 dark:text-light-mint/80 italic">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center space-x-3 pt-4">
                  <div className="flex items-center justify-center w-12 h-12 bg-primary-teal text-white rounded-full font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-deep-teal dark:text-white">{testimonial.name}</p>
                    <p className="text-sm text-text-dark/60 dark:text-light-mint/60">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </Card>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
