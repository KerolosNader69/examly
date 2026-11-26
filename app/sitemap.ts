import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://examly.site';

  const publicRoutes: { route: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
    { route: '', priority: 1.0, changeFrequency: 'daily' },
    { route: '/ai-oral-exams', priority: 0.9, changeFrequency: 'weekly' },
    { route: '/ai-viva-exams', priority: 0.9, changeFrequency: 'weekly' },
    { route: '/ai-exam-grading', priority: 0.9, changeFrequency: 'weekly' },
    { route: '/for-universities', priority: 0.85, changeFrequency: 'weekly' },
    { route: '/for-teachers', priority: 0.85, changeFrequency: 'weekly' },
    { route: '/faq', priority: 0.8, changeFrequency: 'weekly' },
    { route: '/pricing', priority: 0.8, changeFrequency: 'weekly' },
    { route: '/about', priority: 0.8, changeFrequency: 'monthly' },
    { route: '/contact', priority: 0.7, changeFrequency: 'monthly' },
    { route: '/security', priority: 0.7, changeFrequency: 'monthly' },
    { route: '/privacy', priority: 0.3, changeFrequency: 'monthly' },
    { route: '/terms', priority: 0.3, changeFrequency: 'monthly' },
  ];

  return publicRoutes.map(({ route, priority, changeFrequency }) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
