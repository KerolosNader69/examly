import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://examly.site';

  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/pricing',
        '/login',
        '/signup',
        '/privacy',
        '/terms',
        '/contact',
        '/about',
        '/security',
      ],
      disallow: [
        '/dashboard/',
        '/admin/',
        '/api/',
        '/auth/',
        '/exam/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
