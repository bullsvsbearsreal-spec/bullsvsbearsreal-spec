import type { FeasibilityGrade } from './types';
import { GRADE_COLORS } from './utils';

export function IntervalBadge({ interval }: { interval?: string }) {
  if (interval === '1h') return <span className="text-amber-400 text-[8px] font-bold ml-0.5" title="1h payout">*</span>;
  if (interval === '4h') return <span className="text-blue-400 text-[8px] font-bold ml-0.5" title="4h payout">**</span>;
  return null;
}

const GRADE_LABELS: Record<FeasibilityGrade, string> = {
  A: 'Excellent — high liquidity, stable spread, low fees',
  B: 'Good — tradeable with some caveats',
  C: 'Fair — proceed with caution',
  D: 'Poor — fees exceed spread or no liquidity',
};

export function GradeBadge({ grade, isOutlier, isLowLiq, score, flags }: {
  grade: FeasibilityGrade; isOutlier: boolean; isLowLiq: boolean; score: number; flags?: string[];
}) {
  const warnings = [isOutlier && '\u26A0', isLowLiq && '!'].filter(Boolean).join('');
  const tooltip = [
    `Grade ${grade} (${score}/10) — ${GRADE_LABELS[grade]}`,
    '',
    ...(flags && flags.length > 0 ? flags.map(f => `• ${f}`) : []),
    isOutlier && '• Spread >1%/8h — unusually high',
    isLowLiq && '• Min side OI <$50K — low liquidity',
  ].filter(Boolean).join('\n');
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${GRADE_COLORS[grade]}`} title={tooltip}>
      {grade}{warnings && <span className="ml-0.5 text-[8px]">{warnings}</span>}
    </span>
  );
}
