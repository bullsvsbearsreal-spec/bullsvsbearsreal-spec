import Link from 'next/link';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.04] mt-12 bg-black/20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Logo variant="icon" size="sm" />
              <span className="text-white font-bold text-sm">InfoHub</span>
            </div>
            <p className="text-neutral-600 text-xs leading-relaxed max-w-xs">
              Real-time derivatives intelligence across 22 exchanges. Funding rates, open interest, liquidations & more.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider mb-3">Platform</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { name: 'Funding', href: '/funding' },
                { name: 'Open Interest', href: '/open-interest' },
                { name: 'Liquidations', href: '/liquidations' },
                { name: 'Screener', href: '/screener' },
                { name: 'Compare', href: '/compare' },
                { name: 'News', href: '/news' },
                { name: 'Fear & Greed', href: '/fear-greed' },
                { name: 'Heatmap', href: '/market-heatmap' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-neutral-500 hover:text-white text-xs transition-colors py-0.5"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider mb-3">Resources</h4>
            <div className="flex flex-col gap-1.5">
              <Link href="/brand" className="text-neutral-500 hover:text-white text-xs transition-colors py-0.5">
                Brand Kit
              </Link>
              <Link href="/team" className="text-neutral-500 hover:text-white text-xs transition-colors py-0.5">
                Team
              </Link>
              <Link href="/faq" className="text-neutral-500 hover:text-white text-xs transition-colors py-0.5">
                FAQ
              </Link>
              <Link href="/api-docs" className="text-neutral-500 hover:text-white text-xs transition-colors py-0.5">
                API Docs
              </Link>
              <Link href="/terms" className="text-neutral-500 hover:text-white text-xs transition-colors py-0.5">
                Terms & Conditions
              </Link>
              <a href="https://github.com/GroovyGecko88/infohub" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white text-xs transition-colors py-0.5">
                GitHub
              </a>
              <a href="https://x.com/InfoHub_io" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white text-xs transition-colors py-0.5">
                X / Twitter
              </a>
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
