import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Shared page-hero component. Locks in the modern terminal-style
 * vocabulary used across the workflow (May 2026 design refresh):
 *
 *   • gradient-bordered icon tile (w-9, accent-tinted)
 *   • uppercase eyebrow label in tracking-[0.18em]
 *   • text-3xl sm:text-[34px] font-extrabold title with the noun
 *     in accent color
 *   • 13px body copy (max-w-xl, leading-relaxed)
 *   • optional right-side actions cluster aligned bottom-right
 *
 * Pass `accent` to colour the noun + icon tile + dot accents.
 * Available accents map to tailwind utilities; add new ones here
 * rather than passing arbitrary classes so the design system
 * stays a closed set.
 *
 * Usage:
 *   <PageHero
 *     eyebrow="Scanner"
 *     title="Funding-rate"
 *     accentNoun="arb"
 *     accent="hub-yellow"
 *     icon={ArrowLeftRight}
 *     description={<>Long the cheap side, short the expensive side…</>}
 *     actions={<RefreshButton … />}
 *   />
 */

export type HeroAccent =
  | 'hub-yellow'   // default
  | 'purple'       // HL / cycle / sentiment
  | 'violet'       // institutional / ETF
  | 'pink'         // memecoin / discovery
  | 'orange'       // momentum / energy
  | 'red'          // risk / liquidations
  | 'emerald'      // pump / positive
  | 'cyan';        // info / gTrade

interface AccentPalette {
  /** Tint for the icon-tile gradient + border. */
  tile: string;
  /** Color for the icon inside the tile. */
  icon: string;
  /** Color used on the accent noun in the title. */
  noun: string;
}

const PALETTES: Record<HeroAccent, AccentPalette> = {
  'hub-yellow': {
    tile: 'from-hub-yellow/20 to-hub-yellow/[0.04] border-hub-yellow/20',
    icon: 'text-hub-yellow',
    noun: 'text-hub-yellow',
  },
  purple: {
    tile: 'from-purple-500/25 to-purple-500/[0.05] border-purple-400/25',
    icon: 'text-purple-300',
    noun: 'text-purple-300',
  },
  violet: {
    tile: 'from-violet-500/20 to-violet-500/[0.04] border-violet-400/25',
    icon: 'text-violet-300',
    noun: 'text-violet-300',
  },
  pink: {
    tile: 'from-pink-500/20 to-pink-500/[0.04] border-pink-400/25',
    icon: 'text-pink-300',
    noun: 'text-pink-300',
  },
  orange: {
    tile: 'from-orange-500/20 to-orange-500/[0.04] border-orange-400/25',
    icon: 'text-orange-300',
    noun: 'text-orange-300',
  },
  red: {
    tile: 'from-red-500/20 to-red-500/[0.04] border-red-400/25',
    icon: 'text-red-400',
    noun: 'text-red-400',
  },
  emerald: {
    tile: 'from-emerald-500/20 to-emerald-500/[0.04] border-emerald-400/25',
    icon: 'text-emerald-300',
    noun: 'text-emerald-300',
  },
  cyan: {
    tile: 'from-cyan-500/20 to-cyan-500/[0.04] border-cyan-400/25',
    icon: 'text-cyan-300',
    noun: 'text-cyan-300',
  },
};

export interface PageHeroProps {
  /** Lucide icon component — appears in the gradient tile. */
  icon: LucideIcon;
  /** Uppercase pre-title — appears above the H1, tracking-[0.18em]. */
  eyebrow?: string;
  /** Main title. If accentNoun is set, this is the prefix portion. */
  title: string;
  /** Optional accent-colored noun that gets visually highlighted.
   *  e.g. title="Funding-rate" accentNoun="arb" renders "Funding-rate arb"
   *  with "arb" in the accent color. */
  accentNoun?: string;
  /** Defaults to "hub-yellow". */
  accent?: HeroAccent;
  /** Body description. ReactNode so callers can inline <Link>s,
   *  strong tags, and inline color spans without prop explosion. */
  description?: ReactNode;
  /** Right-aligned action cluster (refresh button, CTA chips, etc).
   *  Stacks below the title on mobile, aligns to bottom-right on
   *  large screens. */
  actions?: ReactNode;
  /** Extra elements after the eyebrow line (e.g. a status badge).
   *  Inline with the eyebrow, separated visually. */
  eyebrowExtra?: ReactNode;
  /** Defaults to mb-5; pass mb-4/mb-6 etc to tune to the page. */
  className?: string;
}

export default function PageHero({
  icon: Icon,
  eyebrow,
  title,
  accentNoun,
  accent = 'hub-yellow',
  description,
  actions,
  eyebrowExtra,
  className = 'mb-5',
}: PageHeroProps) {
  const palette = PALETTES[accent];
  return (
    <header className={className}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {(eyebrow || eyebrowExtra) && (
            <div className="inline-flex items-center gap-2 mb-2">
              <div className={`relative w-9 h-9 rounded-xl bg-gradient-to-br ${palette.tile} border flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${palette.icon}`} />
              </div>
              {eyebrow && (
                <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-bold">
                  {eyebrow}
                </span>
              )}
              {eyebrowExtra}
            </div>
          )}
          <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-white leading-[1.05]">
            {title}
            {accentNoun && (
              <>
                {' '}
                <span className={palette.noun}>{accentNoun}</span>
              </>
            )}
          </h1>
          {description && (
            <div className="text-[13px] text-neutral-400 mt-2 max-w-xl leading-relaxed">
              {description}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0 self-start lg:self-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
