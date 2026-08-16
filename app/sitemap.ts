import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://examly.site';

  const routes = [
    '',
    '/pricing',
    '/login',
    '/signup',
    '/about',
    '/contact',
    '/security',
    '/terms',
    '/privacy',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'daily' : route === '/pricing' ? 'weekly' : 'monthly',
    priority: route === '' ? 1.0 : route === '/pricing' || route === '/login' || route === '/signup' ? 0.9 : 0.6,
  }));
}
