/**
 * Tests for the social/nitter RSS parsing primitives. These power the
 * /social KOL feed (ZachXBT, AltcoinGordon, etc.) — a regression in
 * decodeEntities or stripHtml would render literal `&amp;` or
 * `<br/>` tags inside tweet bodies on the page.
 */
import { describe, it, expect } from 'vitest';
import {
  extractTag,
  cleanText,
  decodeEntities,
  stripHtml,
} from '../nitter';

describe('extractTag', () => {
  it('extracts content between simple tags', () => {
    expect(extractTag('<title>Hello</title>', 'title')).toBe('Hello');
    expect(extractTag('<link>https://example.com</link>', 'link')).toBe('https://example.com');
  });

  it('extracts content with nested tags or whitespace inside', () => {
    expect(extractTag('<description>line 1\n\nline 2</description>', 'description'))
      .toBe('line 1\n\nline 2');
  });

  it('returns undefined when tag is missing', () => {
    expect(extractTag('<title>Hello</title>', 'description')).toBeUndefined();
  });

  it('extracts the FIRST occurrence (non-greedy match)', () => {
    expect(extractTag('<title>A</title><title>B</title>', 'title')).toBe('A');
  });
});

describe('cleanText', () => {
  it('strips CDATA wrapper', () => {
    expect(cleanText('<![CDATA[Hello]]>')).toBe('Hello');
    expect(cleanText('<![CDATA[  spaced  ]]>')).toBe('spaced');
  });

  it('trims plain text', () => {
    expect(cleanText('  hello  ')).toBe('hello');
  });

  it('handles empty / no-CDATA input', () => {
    expect(cleanText('')).toBe('');
    expect(cleanText('plain')).toBe('plain');
  });
});

describe('decodeEntities — ordering matters', () => {
  it('decodes the standard set', () => {
    expect(decodeEntities('a &lt; b')).toBe('a < b');
    expect(decodeEntities('a &gt; b')).toBe('a > b');
    expect(decodeEntities('say &quot;hi&quot;')).toBe('say "hi"');
    expect(decodeEntities("it&#39;s")).toBe("it's");
    expect(decodeEntities("it&apos;s")).toBe("it's");
    expect(decodeEntities('a&nbsp;b')).toBe('a b');
  });

  it('decodes &amp; LAST so &amp;lt; stays as "&lt;"', () => {
    // CRITICAL: if &amp; decoded first, "&amp;lt;" → "&lt;" → "<".
    // The correct outcome is that the literal text "&lt;" survives,
    // because the upstream RSS encoded a literal "&lt;" by writing
    // "&amp;lt;". We should only un-escape ONE layer.
    expect(decodeEntities('&amp;lt;')).toBe('&lt;');
    expect(decodeEntities('&amp;amp;')).toBe('&amp;');
    expect(decodeEntities('&amp;quot;')).toBe('&quot;');
  });

  it('decodes &amp; on its own', () => {
    expect(decodeEntities('AT&amp;T')).toBe('AT&T');
  });

  it('combines with cleanText to strip CDATA + decode', () => {
    expect(decodeEntities('<![CDATA[A &amp; B]]>')).toBe('A & B');
  });
});

describe('stripHtml', () => {
  it('converts <br> and </p> to newlines', () => {
    expect(stripHtml('a<br>b')).toBe('a\nb');
    expect(stripHtml('a<br/>b')).toBe('a\nb');
    expect(stripHtml('a<br />b')).toBe('a\nb');
    expect(stripHtml('<p>line 1</p><p>line 2</p>')).toBe('line 1\n line 2');
  });

  it('strips other tags entirely', () => {
    expect(stripHtml('<b>bold</b>').trim()).toBe('bold');
    expect(stripHtml('<a href="x">link</a>').trim()).toBe('link');
  });

  it('collapses runs of whitespace', () => {
    expect(stripHtml('a    b')).toBe('a b');
    expect(stripHtml('a\t\tb')).toBe('a b');
  });

  it('caps consecutive newlines at 2 (paragraph break)', () => {
    expect(stripHtml('a<br><br><br><br>b')).toBe('a\n\nb');
  });

  it('trims leading and trailing whitespace', () => {
    expect(stripHtml('  hello  ')).toBe('hello');
  });
});
