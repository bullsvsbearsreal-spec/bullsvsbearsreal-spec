import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/trailer', '/admin', '/admin-panel', '/profile', '/settings', '/reset-password', '/forgot-password'],
      },
    ],
    sitemap: 'https://info-hub.io/sitemap.xml',
  };
}
