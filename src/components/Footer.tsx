import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.04] mt-12">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-hub-yellow font-bold text-sm">InfoHub</span>
            <span className="text-neutral-700 text-xs">
              Real-time derivatives data across 21 exchanges
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/api-docs"
              className="text-neutral-600 hover:text-white text-xs transition-colors"
            >
              API Docs
            </Link>
            <a
              href="https://github.com/GroovyGecko88/infohub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-600 hover:text-white text-xs transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://x.com/InfoHub_io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-600 hover:text-white text-xs transition-colors"
            >
              X / Twitter
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
