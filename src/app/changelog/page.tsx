import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { CHANGELOG, type ChangelogEntry, type ChangelogTag } from '@/lib/changelog';
import { Sparkles, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Changelog · InfoHub',
  description: 'What we shipped recently — new tools, fixes, and improvements to the InfoHub data terminal.',
};

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
  return (
    <>
      <Header />
      <main id="main-content" className="max-w-[900px] mx-auto w-full px-4 py-8">
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-hub-yellow/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-hub-yellow" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Changelog</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono ml-2">
              {CHANGELOG.length} releases
            </span>
          </div>
          <p className="text-sm text-neutral-500 max-w-xl leading-relaxed">
            What we&apos;ve shipped recently. New features, fixes, and improvements to the InfoHub
            data terminal. No marketing fluff — what changed and why it matters.
          </p>
        </header>

        <section>
          {CHANGELOG.map((entry, i) => (
            <EntryCard key={`${entry.date}-${i}`} entry={entry} />
          ))}
        </section>

        <footer className="mt-8 p-4 bg-white/[0.02] rounded-xl border border-white/[0.06] text-center">
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
      </main>
      <Footer />
    </>
  );
}
