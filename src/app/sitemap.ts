import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://info-hub.io';

  const pages = [
    { path: '/', priority: 1.0, changeFrequency: 'daily' as const },
    { path: '/funding', priority: 0.9, changeFrequency: 'hourly' as const },
    { path: '/open-interest', priority: 0.9, changeFrequency: 'hourly' as const },
    { path: '/liquidations', priority: 0.9, changeFrequency: 'hourly' as const },
    { path: '/screener', priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/prediction-markets', priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/funding-heatmap', priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/market-heatmap', priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/top-movers', priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/fear-greed', priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/longshort', priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/options', priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/basis', priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/correlation', priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/dominance', priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/token-unlocks', priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/economic-calendar', priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/news', priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/compare', priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/alerts', priority: 0.6, changeFrequency: 'weekly' as const },
    { path: '/rsi-heatmap', priority: 0.6, changeFrequency: 'hourly' as const },
    { path: '/cvd', priority: 0.6, changeFrequency: 'hourly' as const },
    { path: '/exchange-comparison', priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/api-docs', priority: 0.5, changeFrequency: 'weekly' as const },
    { path: '/faq', priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/brand', priority: 0.3, changeFrequency: 'monthly' as const },
    { path: '/team', priority: 0.3, changeFrequency: 'monthly' as const },
    { path: '/terms', priority: 0.2, changeFrequency: 'monthly' as const },
  ];

  return pages.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
