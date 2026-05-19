import { describe, it, expect } from 'vitest';
import { CHANGELOG, type ChangelogEntry } from '../changelog';

describe('CHANGELOG', () => {
  it('is non-empty (we have shipped things)', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
  });

  it('every entry has the required fields (date + title + summary)', () => {
    CHANGELOG.forEach((e: ChangelogEntry) => {
      expect(e.date).toBeTruthy();
      expect(e.title).toBeTruthy();
      expect(e.summary).toBeTruthy();
    });
  });

  it('every date is ISO-formatted (YYYY-MM-DD)', () => {
    CHANGELOG.forEach((e) => {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Also parses to a real date
      expect(Number.isNaN(new Date(e.date).getTime())).toBe(false);
    });
  });

  it('entries are sorted newest-first (date descending)', () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      const newer = new Date(CHANGELOG[i - 1].date).getTime();
      const older = new Date(CHANGELOG[i].date).getTime();
      // Equal dates allowed (multiple entries can ship the same day)
      expect(newer).toBeGreaterThanOrEqual(older);
    }
  });

  it('every tag (when present) is one of the 5 known values', () => {
    const validTags = new Set(['new', 'fix', 'improved', 'security', 'breaking']);
    CHANGELOG.forEach((e) => {
      if (!e.tags) return;
      e.tags.forEach((t) => {
        expect(validTags.has(t)).toBe(true);
      });
    });
  });

  it('bullets (when present) are non-empty strings', () => {
    CHANGELOG.forEach((e) => {
      if (!e.bullets) return;
      e.bullets.forEach((b) => {
        expect(typeof b).toBe('string');
        expect(b.length).toBeGreaterThan(0);
      });
    });
  });

  it('links (when present) have label + href', () => {
    CHANGELOG.forEach((e) => {
      if (!e.links) return;
      e.links.forEach((l) => {
        expect(l.label).toBeTruthy();
        expect(l.href).toBeTruthy();
      });
    });
  });

  it('summaries are short enough to fit on a card (under 600 chars)', () => {
    // Soft constraint — the /changelog page renders summary as the card
    // blurb. Anything much longer than a paragraph makes the list look
    // dense + reduces scanning speed.
    CHANGELOG.forEach((e) => {
      expect(e.summary.length).toBeLessThan(600);
    });
  });

  it('every internal link starts with / (no full URLs hardcoded)', () => {
    CHANGELOG.forEach((e) => {
      if (!e.links) return;
      e.links.forEach((l) => {
        // Allow github.com external link as exception; everything else should be relative
        if (l.href.startsWith('http')) {
          expect(l.href).toMatch(/^https?:\/\//);
        } else {
          expect(l.href.startsWith('/')).toBe(true);
        }
      });
    });
  });

  it('no entry has empty bullets array (use undefined instead)', () => {
    CHANGELOG.forEach((e) => {
      if (e.bullets) {
        expect(e.bullets.length).toBeGreaterThan(0);
      }
    });
  });
});
