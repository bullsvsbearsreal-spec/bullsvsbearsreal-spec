import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/trailer'],
      },
    ],
    sitemap: 'https://info-hub.io/sitemap.xml',
  };
}
