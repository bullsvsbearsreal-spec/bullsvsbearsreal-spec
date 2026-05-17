import { describe, it, expect } from 'vitest';
import { rankReferrers, findRank } from '../leaderboard';

describe('rankReferrers', () => {
  it('returns empty array for empty input', () => {
    expect(rankReferrers([])).toEqual([]);
  });

  it('assigns rank 1 to a single entry', () => {
    const out = rankReferrers([{ codePrefix: 'ABCD', signups: 1, verified: 1 }]);
    expect(out).toEqual([{ codePrefix: 'ABCD', signups: 1, verified: 1, rank: 1 }]);
  });

  it('sorts by verified DESC first', () => {
    const out = rankReferrers([
      { codePrefix: 'LOW', signups: 100, verified: 1 },
      { codePrefix: 'HI', signups: 5, verified: 10 },
    ]);
    expect(out[0].codePrefix).toBe('HI');
    expect(out[0].rank).toBe(1);
    expect(out[1].codePrefix).toBe('LOW');
    expect(out[1].rank).toBe(2);
  });

  it('uses signups as tiebreaker when verified counts match', () => {
    const out = rankReferrers([
      { codePrefix: 'A', signups: 5, verified: 3 },
      { codePrefix: 'B', signups: 10, verified: 3 },
    ]);
    expect(out[0].codePrefix).toBe('B');  // higher signups breaks tie
    expect(out[1].codePrefix).toBe('A');
  });

  it('assigns the same rank to fully-tied entries (1224 style)', () => {
    const out = rankReferrers([
      { codePrefix: 'A', signups: 5, verified: 3 },
      { codePrefix: 'B', signups: 5, verified: 3 },  // tied with A
      { codePrefix: 'C', signups: 1, verified: 1 },  // worse
    ]);
    expect(out[0].rank).toBe(1);
    expect(out[1].rank).toBe(1);  // tied → same rank
    expect(out[2].rank).toBe(3);  // skips rank 2 (1224 style, NOT 1223)
  });

  it('does not mutate the input array', () => {
    const input = [
      { codePrefix: 'A', signups: 1, verified: 0 },
      { codePrefix: 'B', signups: 5, verified: 3 },
    ];
    const snap = JSON.parse(JSON.stringify(input));
    rankReferrers(input);
    expect(input).toEqual(snap);
  });

  it('handles a realistic 20-entry leaderboard', () => {
    const out = rankReferrers(Array.from({ length: 20 }, (_, i) => ({
      codePrefix: `R${i.toString().padStart(3, '0')}`,
      signups: 100 - i,
      verified: 50 - i,
    })));
    expect(out).toHaveLength(20);
    expect(out[0].rank).toBe(1);
    expect(out[19].rank).toBe(20);
    // ranks should be 1..20 with no gaps for this all-unique input
    expect(out.map((r) => r.rank)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });

  it('handles the edge case where everyone is tied', () => {
    const out = rankReferrers(Array.from({ length: 5 }, (_, i) => ({
      codePrefix: `T${i}`,
      signups: 3,
      verified: 1,
    })));
    // All tied — all rank 1
    expect(out.every((r) => r.rank === 1)).toBe(true);
  });
});

describe('findRank', () => {
  const sample = rankReferrers([
    { codePrefix: 'TOP1', signups: 10, verified: 8 },
    { codePrefix: 'TOP2', signups: 8, verified: 5 },
    { codePrefix: 'TOP3', signups: 5, verified: 2 },
  ]);

  it('returns the rank of a known user', () => {
    expect(findRank(sample, 'TOP1')).toBe(1);
    expect(findRank(sample, 'TOP2')).toBe(2);
    expect(findRank(sample, 'TOP3')).toBe(3);
  });

  it('returns null when the user is not in the snapshot', () => {
    expect(findRank(sample, 'XXXX')).toBeNull();
    expect(findRank(sample, '')).toBeNull();
  });

  it('returns null for empty leaderboard', () => {
    expect(findRank([], 'ABCD')).toBeNull();
  });
});
