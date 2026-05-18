import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We import inside each test via vi.resetModules() so the env-var-driven
// dry-run gate is read fresh.

const CREDS = {
  TWITTER_API_KEY: 'k',
  TWITTER_API_SECRET: 's',
  TWITTER_ACCESS_TOKEN: 't',
  TWITTER_ACCESS_TOKEN_SECRET: 'ts',
};

describe('postTweet — dry-run gate', () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear all twitter env vars to test the "no creds → dry run" path
    delete process.env.TWITTER_API_KEY;
    delete process.env.TWITTER_API_SECRET;
    delete process.env.TWITTER_ACCESS_TOKEN;
    delete process.env.TWITTER_ACCESS_TOKEN_SECRET;
    delete process.env.AUTO_TWEET_DRY_RUN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns dry-run result when no credentials are set', async () => {
    const { postTweet } = await import('../twitter');
    const result = await postTweet('hello world');
    expect(result.dryRun).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.tweetId).toBeNull();
  });

  it('returns dry-run when AUTO_TWEET_DRY_RUN=true even with full creds', async () => {
    Object.assign(process.env, CREDS, { AUTO_TWEET_DRY_RUN: 'true' });
    const { postTweet } = await import('../twitter');
    const result = await postTweet('test');
    expect(result.dryRun).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('dry-run is triggered when any one cred env var is missing', async () => {
    Object.assign(process.env, CREDS);
    delete process.env.TWITTER_ACCESS_TOKEN_SECRET;
    const { postTweet } = await import('../twitter');
    const result = await postTweet('test');
    expect(result.dryRun).toBe(true);
  });

  it('isDryRun helper reflects same logic', async () => {
    const { __testing } = await import('../twitter');
    expect(__testing.isDryRun()).toBe(true);  // no creds

    Object.assign(process.env, CREDS);
    expect(__testing.isDryRun()).toBe(false);  // all creds present
  });
});

describe('postTweet — network success path', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, CREDS);
    delete process.env.AUTO_TWEET_DRY_RUN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok=true + tweetId when Twitter responds 200 with a valid body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: '1234567890' } }), { status: 200 }),
    );

    const { postTweet } = await import('../twitter');
    const result = await postTweet('hello world');

    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(false);
    expect(result.tweetId).toBe('1234567890');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('sends the tweet text as JSON in the request body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: '1' } }), { status: 200 }),
    );

    const { postTweet } = await import('../twitter');
    await postTweet('my tweet content');

    const callArgs = fetchSpy.mock.calls[0];
    const init = callArgs[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ text: 'my tweet content' }));
  });

  it('includes an OAuth 1.0a Authorization header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: '1' } }), { status: 200 }),
    );

    const { postTweet } = await import('../twitter');
    await postTweet('test');

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeDefined();
    expect(headers.Authorization).toMatch(/^OAuth /);
    expect(headers.Authorization).toContain('oauth_signature');
    expect(headers.Authorization).toContain('oauth_consumer_key');
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('postTweet — failure paths', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, CREDS);
    delete process.env.AUTO_TWEET_DRY_RUN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok=false on non-200 Twitter response with truncated error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('rate limited please try later', { status: 429 }),
    );

    const { postTweet } = await import('../twitter');
    const result = await postTweet('test');

    expect(result.ok).toBe(false);
    expect(result.dryRun).toBe(false);
    expect(result.tweetId).toBeNull();
    expect(result.error).toContain('429');
    expect(result.error).toContain('rate limited');
  });

  it('returns ok=false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('econnreset'));

    const { postTweet } = await import('../twitter');
    const result = await postTweet('test');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('econnreset');
  });

  it('truncates long error bodies to 200 chars', async () => {
    const longErrorBody = 'x'.repeat(500);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(longErrorBody, { status: 500 }),
    );

    const { postTweet } = await import('../twitter');
    const result = await postTweet('test');

    expect(result.ok).toBe(false);
    // error includes "Twitter API 500: " + up to 200 chars of body
    expect(result.error!.length).toBeLessThan(300);
  });

  it('handles Twitter response with no body gracefully', async () => {
    const failedResponse = new Response('', { status: 500 });
    // Make .text() throw to simulate body-read failure
    vi.spyOn(failedResponse, 'text').mockRejectedValue(new Error('read failed'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(failedResponse);

    const { postTweet } = await import('../twitter');
    const result = await postTweet('test');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('<no body>');
  });
});
