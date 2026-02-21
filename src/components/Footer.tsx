import Link from 'next/link';
import Logo from './Logo';
import { ALL_EXCHANGES } from '@/lib/constants';
import { Github, Twitter, MessageCircle, Percent, PieChart, Zap, SlidersHorizontal, Rocket, Thermometer, Newspaper, Grid3X3 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.04] mt-12 bg-black/20 relative">
      {/* Top accent line */}
      <div className="accent-line absolute top-0 left-0 right-0" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Logo variant="icon" size="sm" />
              <span className="text-white font-bold text-sm">InfoHub</span>
              <span className="text-[10px] font-bold text-hub-yellow bg-hub-yellow/10 px-1.5 py-0.5 rounded">
                {ALL_EXCHANGES.length} exchanges
              </span>
            </div>
            <p className="text-neutral-600 text-xs leading-relaxed max-w-xs mb-4">
              Real-time derivatives intelligence. Funding rates, open interest, liquidations & more.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-2">
              <a
                href="https://x.com/InfoHub_io"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/[0.04] text-neutral-500 hover:text-amber-400 hover:bg-white/[0.08] transition-colors"
                aria-label="Follow on X / Twitter"
              >
                <Twitter className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://github.com/GroovyGecko88/infohub"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/[0.04] text-neutral-500 hover:text-amber-400 hover:bg-white/[0.08] transition-colors"
                aria-label="View on GitHub"
              >
                <Github className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://discord.gg/infohub"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/[0.04] text-neutral-500 hover:text-amber-400 hover:bg-white/[0.08] transition-colors"
                aria-label="Join Discord"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Trading */}
          <div>
            <h4 className="section-label mb-3">Trading</h4>
            <div className="flex flex-col gap-1">
              {[
                { name: 'Funding Rates', href: '/funding', icon: Percent },
                { name: 'Open Interest', href: '/open-interest', icon: PieChart },
                { name: 'Liquidations', href: '/liquidations', icon: Zap },
                { name: 'Screener', href: '/screener', icon: SlidersHorizontal },
                { name: 'Funding Heatmap', href: '/funding-heatmap', icon: Grid3X3 },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 text-neutral-500 hover:text-white text-xs transition-colors py-1"
                >
                  <link.icon className="w-3 h-3 flex-shrink-0" />
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Markets */}
          <div>
            <h4 className="section-label mb-3">Markets</h4>
            <div className="flex flex-col gap-1">
              {[
                { name: 'Top Movers', href: '/top-movers', icon: Rocket },
                { name: 'Fear & Greed', href: '/fear-greed', icon: Thermometer },
                { name: 'News', href: '/news', icon: Newspaper },
                { name: 'Heatmap', href: '/market-heatmap', icon: Grid3X3 },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 text-neutral-500 hover:text-white text-xs transition-colors py-1"
                >
                  <link.icon className="w-3 h-3 flex-shrink-0" />
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="section-label mb-3">Resources</h4>
            <div className="flex flex-col gap-1">
              {[
                { name: 'Brand Kit', href: '/brand' },
                { name: 'Team', href: '/team' },
                { name: 'FAQ', href: '/faq' },
                { name: 'API Docs', href: '/api-docs' },
                { name: 'Terms & Conditions', href: '/terms' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-neutral-500 hover:text-white text-xs transition-colors py-1"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.04] pt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-neutral-700 text-[10px]">
            &copy; {new Date().getFullYear()} InfoHub. Data aggregated from public exchange APIs.
          </span>
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
            <span className="text-neutral-600 text-[10px]">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
