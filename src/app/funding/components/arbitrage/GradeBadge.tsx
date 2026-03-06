import type { FeasibilityGrade } from './types';
import { GRADE_COLORS } from './utils';

export function IntervalBadge({ interval }: { interval?: string }) {
  if (interval === '1h') return <span className="text-amber-400 text-[8px] font-bold ml-0.5" title="1h payout">*</span>;
  if (interval === '4h') return <span className="text-blue-400 text-[8px] font-bold ml-0.5" title="4h payout">**</span>;
  return null;
}

export function GradeBadge({ grade, isOutlier, isLowLiq, score }: {
  grade: FeasibilityGrade; isOutlier: boolean; isLowLiq: boolean; score: number;
}) {
  const warnings = [isOutlier && '\u26A0', isLowLiq && '!'].filter(Boolean).join('');
  const tooltip = [
    `Feasibility: ${grade} (score ${score}/10)`,
    isOutlier && 'Spread >1%/8h — unusually high',
    isLowLiq && 'Min side OI <$50K — low liquidity',
  ].filter(Boolean).join('\n');
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${GRADE_COLORS[grade]}`} title={tooltip}>
      {grade}{warnings && <span className="ml-0.5 text-[8px]">{warnings}</span>}
    </span>
  );
}
