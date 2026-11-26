/**
 * Schema.org JSON-LD Structured Data Generators for Examly
 * Only includes factual, verified data present on the site.
 */

export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://examly.site';

export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Examly',
    url: BASE_URL,
    logo: `${BASE_URL}/icon.png`,
    description: 'AI-powered oral examination and evaluation platform for educators and universities.',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@examly.site',
      contactType: 'customer support',
    },
  };
}

export function getWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Examly',
    url: BASE_URL,
    description: 'AI-Powered Oral Exams for Teachers & Students.',
    publisher: {
      '@type': 'Organization',
      name: 'Examly',
      logo: `${BASE_URL}/icon.png`,
    },
  };
}

export function getSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Examly',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: BASE_URL,
    description: 'Transform your teaching with AI-graded oral exams. Fast, fair, secure, and accessible for educators.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    featureList: [
      'AI Speech-to-Text Grading Engine',
      'Real-time Voice Analysis',
      'Browser Lockdown & Cheating Prevention',
      'Teacher Oversight & Final Score Control',
      'Analytics Dashboard',
    ],
  };
}

export function getBreadcrumbSchema(items: { name: string; item: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: it.name,
      item: it.item.startsWith('http') ? it.item : `${BASE_URL}${it.item}`,
    })),
  };
}

export function getFAQPageSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

