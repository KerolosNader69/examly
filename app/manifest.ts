import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Examly — AI-Powered Oral Exams',
    short_name: 'Examly',
    description: 'Transform oral assessment with Examly. Create AI-graded speaking exams, automate evaluation, and prevent tab switching.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0D282C',
    theme_color: '#14B8A6',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
