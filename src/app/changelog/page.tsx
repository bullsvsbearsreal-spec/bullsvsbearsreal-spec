'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { CHANGELOG, type ChangelogEntry, type ChangelogTag } from '@/lib/changelog';
import { Sparkles, ArrowRight, Printer, Shield } from 'lucide-react';

const TAG_TONES: Record<ChangelogTag, string> = {
  new:        'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  fix:        'bg-rose-500/15 text-rose-300 border-rose-400/30',
  improved:   'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
  security:   'bg-amber-500/15 text-amber-300 border-amber-400/30',
  breaking:   'bg-violet-500/15 text-violet-300 border-violet-400/30',
};

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  return (
    <article className="card-premium p-5 mb-3">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <time className="font-mono text-[11px] text-neutral-500 uppercase tracking-wider">
          {fmtDate(entry.date)}
        </time>
        {entry.tags?.map(t => (
          <span
            key={t}
            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${TAG_TONES[t]}`}
          >
            {t}
          </span>
        ))}
      </div>
      <h2 className="text-lg font-bold text-white mb-1.5 tracking-tight">{entry.title}</h2>
      <p className="text-sm text-neutral-400 leading-relaxed mb-3">{entry.summary}</p>

      {entry.bullets && entry.bullets.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {entry.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
              <span className="text-hub-yellow flex-shrink-0 mt-0.5">•</span>
              <span className="leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
      )}

      {entry.links && entry.links.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.04]">
          {entry.links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-1 text-xs text-hub-yellow hover:underline"
            >
              {l.label}
              <ArrowRight className="w-3 h-3" />
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

export default function ChangelogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = userRole === 'admin';

  // Send unauthenticated users to login; non-admins see a clean access-denied card.
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/changelog');
    }
  }, [status, router]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  // Loading state while session resolves.
  if (status === 'loading') {
    return (
      <>
        <Header />
        <main className="max-w-[900px] mx-auto w-full px-4 py-8">
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            Checking access…
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // Authenticated but not admin → access-denied card.
  if (status === 'authenticated' && !isAdmin) {
    return (
      <>
        <Header />
        <main id="main-content" className="max-w-[640px] mx-auto w-full px-4 py-12">
          <div className="card-premium p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-amber-500/[0.12] border border-amber-400/30 flex items-center justify-center">
              <Shield className="w-7 h-7 text-amber-400" />
            </div>
            <h1 className="text-lg font-bold text-white mb-2">Admin access required</h1>
            <p className="text-sm text-neutral-400 mb-5 max-w-md mx-auto leading-relaxed">
              The changelog is restricted to InfoHub administrators. Your account
              {session?.user?.email ? <> (<span className="text-white">{session.user.email}</span>)</> : null}
              {' '}doesn&apos;t have admin permissions.
            </p>
            <div className="inline-flex gap-2">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded bg-hub-yellow text-black hover:bg-hub-yellow/90 transition-colors"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/"
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded bg-transparent border border-white/[0.08] text-neutral-400 hover:text-white transition-colors"
              >
                Home
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // Unauthenticated state (briefly visible before router.replace fires).
  if (status === 'unauthenticated') {
    return (
      <>
        <Header />
        <main className="max-w-[640px] mx-auto w-full px-4 py-12">
          <div className="card-premium p-8 text-center text-neutral-400 text-sm">
            Redirecting to sign in…
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main id="main-content" className="max-w-[900px] mx-auto w-full px-4 py-8 print:py-0 print:max-w-full">
        <header className="mb-6 print:mb-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-hub-yellow/10 flex items-center justify-center print:bg-transparent print:border print:border-black">
              <Sparkles className="w-4 h-4 text-hub-yellow print:text-black" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight print:text-black">Changelog</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono ml-2 print:text-neutral-700">
              {CHANGELOG.length} releases
            </span>
            <button
              onClick={handlePrint}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-neutral-300 hover:text-white hover:border-hub-yellow/30 transition-all text-xs font-medium print:hidden"
              title="Print or save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
          </div>
          <p className="text-sm text-neutral-500 max-w-xl leading-relaxed print:text-neutral-700">
            What we&apos;ve shipped recently. New features, fixes, and improvements to the InfoHub
            data terminal. No marketing fluff — what changed and why it matters.
          </p>
          <p className="hidden print:block text-[10px] text-neutral-500 mt-2">
            Generated from <span className="font-mono">info-hub.io/changelog</span> · {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </header>

        <section>
          {CHANGELOG.map((entry, i) => (
            <EntryCard key={`${entry.date}-${i}`} entry={entry} />
          ))}
        </section>

        <footer className="mt-8 p-4 bg-white/[0.02] rounded-xl border border-white/[0.06] text-center print:hidden">
          <p className="text-sm text-neutral-400 mb-2">Want to influence what gets built next?</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://x.com/info_hub69"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-hub-yellow hover:underline"
            >
              DM @info_hub69 on X
            </a>
            <span className="text-neutral-700 text-xs">·</span>
            <a
              href="https://t.me/+Z6SQGJ57SlwyY2Rk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-hub-yellow hover:underline"
            >
              Join Telegram
            </a>
            <span className="text-neutral-700 text-xs">·</span>
            <Link href="/donate" className="text-xs text-hub-yellow hover:underline">
              Support InfoHub
            </Link>
          </div>
        </footer>

        {/* Print-only footer */}
        <div className="hidden print:block mt-6 pt-4 border-t border-neutral-300 text-center text-[10px] text-neutral-600">
          info-hub.io · the trader&apos;s data terminal · contact@info-hub.io · @info_hub69
        </div>
      </main>
      <Footer />

      {/* Print-only stylesheet — converts dark UI to clean black-on-white PDF */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 18mm 14mm;
          }
          body, html {
            background: white !important;
            color: black !important;
          }
          /* Hide nav + footer in print */
          header[class*="sticky"], footer, nav,
          [class*="Header"], [aria-label="Sidebar"],
          .skip-to-content {
            display: none !important;
          }
          /* Force print-friendly colors on all chrome */
          * {
            color: black !important;
            border-color: #ddd !important;
            background-image: none !important;
          }
          /* Card backgrounds → white with light border */
          .card-premium, [class*="card-premium"] {
            background: white !important;
            border: 1px solid #e5e5e5 !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
          /* Tag chips: keep their color hint via border, drop the background tint */
          [class*="bg-emerald-500/15"] { color: #059669 !important; border-color: #059669 !important; }
          [class*="bg-rose-500/15"]    { color: #dc2626 !important; border-color: #dc2626 !important; }
          [class*="bg-cyan-500/15"]    { color: #0891b2 !important; border-color: #0891b2 !important; }
          [class*="bg-amber-500/15"]   { color: #d97706 !important; border-color: #d97706 !important; }
          [class*="bg-violet-500/15"]  { color: #7c3aed !important; border-color: #7c3aed !important; }
          /* Yellow accent → readable orange in print */
          [class*="text-hub-yellow"] { color: #c2410c !important; }
          /* Links: show URL after text for printed reference */
          a[href^="/"]::after,
          a[href^="https"]::after {
            content: " (" attr(href) ")";
            font-size: 0.85em;
            color: #888 !important;
          }
        }
      `}</style>
    </>
  );
}
