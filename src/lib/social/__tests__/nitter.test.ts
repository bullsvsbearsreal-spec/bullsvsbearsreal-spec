import { describe, it, expect } from 'vitest';
import { extractTag, cleanText, decodeEntities, stripHtml } from '../nitter';

describe('extractTag', () => {
  it('extracts content between simple tags', () => {
    expect(extractTag('<title>Hello world</title>', 'title')).toBe('Hello world');
  });

  it('returns undefined when tag is missing', () => {
    expect(extractTag('<other>text</other>', 'title')).toBeUndefined();
  });

  it('handles multiline content (non-greedy)', () => {
    const xml = '<description>line 1\nline 2\nline 3</description>';
    expect(extractTag(xml, 'description')).toBe('line 1\nline 2\nline 3');
  });

  it('returns the FIRST match (non-greedy across nested tags)', () => {
    const xml = '<title>First</title><title>Second</title>';
    expect(extractTag(xml, 'title')).toBe('First');
  });

  it('handles tags with CDATA-style content', () => {
    const xml = '<description><![CDATA[Some text]]></description>';
    expect(extractTag(xml, 'description')).toBe('<![CDATA[Some text]]>');
  });

  it('returns empty string when tag is empty', () => {
    expect(extractTag('<title></title>', 'title')).toBe('');
  });
});

describe('cleanText', () => {
  it('strips CDATA wrappers', () => {
    expect(cleanText('<![CDATA[Hello]]>')).toBe('Hello');
  });

  it('trims whitespace', () => {
    expect(cleanText('  Hello  ')).toBe('Hello');
  });

  it('strips CDATA + trims combined', () => {
    expect(cleanText('  <![CDATA[Hello world]]>  ')).toBe('Hello world');
  });

  it('handles missing CDATA wrappers (no-op except trim)', () => {
    expect(cleanText('plain text')).toBe('plain text');
  });

  it('handles empty string', () => {
    expect(cleanText('')).toBe('');
  });
});

describe('decodeEntities', () => {
  it('decodes &amp;', () => {
    expect(decodeEntities('Cats &amp; Dogs')).toBe('Cats & Dogs');
  });

  it('decodes &lt; and &gt;', () => {
    expect(decodeEntities('1 &lt; 2 &gt; 0')).toBe('1 < 2 > 0');
  });

  it('decodes &quot;', () => {
    expect(decodeEntities('&quot;hello&quot;')).toBe('"hello"');
  });

  it('decodes both &#39; and &apos; to apostrophe', () => {
    expect(decodeEntities('don&#39;t')).toBe("don't");
    expect(decodeEntities('don&apos;t')).toBe("don't");
  });

  it('decodes &nbsp; to space', () => {
    expect(decodeEntities('hello&nbsp;world')).toBe('hello world');
  });

  it('decodes &amp; LAST (preserves double-encoded entities)', () => {
    // &amp;lt; should stay &lt; (one level of decoding), NOT become <
    expect(decodeEntities('&amp;lt;')).toBe('&lt;');
  });

  it('combines CDATA stripping (inherits cleanText)', () => {
    expect(decodeEntities('<![CDATA[Cats &amp; Dogs]]>')).toBe('Cats & Dogs');
  });

  it('handles plain text unchanged', () => {
    expect(decodeEntities('plain text')).toBe('plain text');
  });
});

describe('stripHtml', () => {
  it('converts <br> to newline', () => {
    expect(stripHtml('line 1<br>line 2')).toBe('line 1\nline 2');
    expect(stripHtml('line 1<br/>line 2')).toBe('line 1\nline 2');
    expect(stripHtml('line 1<br />line 2')).toBe('line 1\nline 2');
  });

  it('converts </p> to newline (opening <p> becomes space)', () => {
    // The function replaces </p> with \n FIRST, then generic <[^>]+> with ' '
    // So <p>para 1</p><p>para 2</p> → "para 1\n para 2\n" → trimmed
    const out = stripHtml('<p>para 1</p><p>para 2</p>');
    expect(out).toContain('para 1');
    expect(out).toContain('para 2');
    expect(out).toContain('\n');  // newline preserved
  });

  it('removes other HTML tags', () => {
    expect(stripHtml('<b>bold</b> and <i>italic</i>')).toBe('bold and italic');
  });

  it('collapses 3+ newlines to 2', () => {
    expect(stripHtml('a<br><br><br><br>b')).toBe('a\n\nb');
  });

  it('collapses multiple spaces / tabs into one', () => {
    expect(stripHtml('a    b\t\tc')).toBe('a b c');
  });

  it('handles a realistic tweet block (br + link + entity)', () => {
    const html = 'Check this out!<br>Visit <a href="https://example.com">my site</a>';
    const out = stripHtml(html);
    expect(out).toContain('Check this out');
    expect(out).toContain('my site');
    expect(out).not.toContain('<a');
    expect(out).not.toContain('href');
  });

  it('trims leading/trailing whitespace', () => {
    expect(stripHtml('  <p>hello</p>  ')).toBe('hello');
  });

  it('returns empty string for input with only tags', () => {
    expect(stripHtml('<br><br><br>')).toBe('');
  });
});
