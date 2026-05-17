import { describe, it, expect } from 'vitest';
import { tweetIntent, telegramShareIntent } from '../tweetIntent';

describe('tweetIntent', () => {
  it('encodes plain text', () => {
    const url = tweetIntent({ text: 'hello world' });
    expect(url).toBe('https://twitter.com/intent/tweet?text=hello+world');
  });

  it('url-encodes special characters in text', () => {
    const url = tweetIntent({ text: '50% off!' });
    expect(url).toContain('text=50%25+off%21');
  });

  it('url-encodes URLs inside text correctly', () => {
    const url = tweetIntent({ text: 'check out https://info-hub.io/invite' });
    expect(url).toContain('https%3A%2F%2Finfo-hub.io%2Finvite');
  });

  it('includes via= when provided', () => {
    const url = tweetIntent({ text: 'hi', via: 'info_hub69' });
    expect(url).toContain('via=info_hub69');
  });

  it('joins hashtags with commas (Twitter spec)', () => {
    const url = tweetIntent({ text: 'hi', hashtags: ['Bitcoin', 'DeFi'] });
    expect(url).toContain('hashtags=Bitcoin%2CDeFi');
  });

  it('omits hashtags param when array is empty', () => {
    const url = tweetIntent({ text: 'hi', hashtags: [] });
    expect(url).not.toContain('hashtags=');
  });

  it('handles newlines in text', () => {
    const url = tweetIntent({ text: 'line one\nline two' });
    // %0A is encoded newline; Twitter renders it as a line break in the
    // compose textarea, which is what we want for multi-paragraph
    // share copy.
    expect(url).toContain('line+one%0Aline+two');
  });

  it('returns a valid URL parseable by URL constructor', () => {
    const url = tweetIntent({ text: 'I am ranked #3 with 5 verified referrals' });
    expect(() => new URL(url)).not.toThrow();
    const parsed = new URL(url);
    expect(parsed.host).toBe('twitter.com');
    expect(parsed.pathname).toBe('/intent/tweet');
    expect(parsed.searchParams.get('text')).toBe('I am ranked #3 with 5 verified referrals');
  });

  it('handles emoji + non-ASCII', () => {
    const url = tweetIntent({ text: '🔥 hot take' });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('text')).toBe('🔥 hot take');
  });
});

describe('telegramShareIntent', () => {
  it('builds the canonical share URL with url= param', () => {
    const url = telegramShareIntent({ url: 'https://info-hub.io/invite' });
    const parsed = new URL(url);
    expect(parsed.host).toBe('t.me');
    expect(parsed.pathname).toBe('/share/url');
    expect(parsed.searchParams.get('url')).toBe('https://info-hub.io/invite');
  });

  it('includes text when provided', () => {
    const url = telegramShareIntent({
      url: 'https://info-hub.io/invite',
      text: 'derivatives terminal · free tier',
    });
    expect(url).toContain('text=derivatives+terminal');
  });

  it('omits text= when not provided', () => {
    const url = telegramShareIntent({ url: 'https://info-hub.io' });
    expect(url).not.toContain('text=');
  });

  it('url-encodes the URL itself (e.g. query string params)', () => {
    const url = telegramShareIntent({
      url: 'https://info-hub.io/signup?ref=ABCD123456',
    });
    expect(url).toContain('signup%3Fref%3DABCD123456');
  });

  it('returns a valid URL parseable by URL constructor', () => {
    const url = telegramShareIntent({
      url: 'https://info-hub.io/signup?ref=XYZ',
      text: 'check this out',
    });
    expect(() => new URL(url)).not.toThrow();
  });
});
