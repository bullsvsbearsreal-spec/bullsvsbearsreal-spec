import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The vitest config uses environment: 'node' (no jsdom). We stub the
// browser globals (window, document, navigator) just enough to test
// the path-selection logic without requiring a real DOM.

describe('copyToClipboard', () => {
  let origWindow: unknown;
  let origDocument: unknown;
  let origNavigator: unknown;

  beforeEach(() => {
    origWindow = (globalThis as Record<string, unknown>).window;
    origDocument = (globalThis as Record<string, unknown>).document;
    origNavigator = (globalThis as Record<string, unknown>).navigator;
    vi.resetModules();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).window = origWindow;
    (globalThis as Record<string, unknown>).document = origDocument;
    (globalThis as Record<string, unknown>).navigator = origNavigator;
    vi.restoreAllMocks();
  });

  it('returns false in non-browser env (no window/document)', async () => {
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).document;
    const { copyToClipboard } = await import('../copyToClipboard');
    const result = await copyToClipboard('hello');
    expect(result).toBe(false);
  });

  it('uses navigator.clipboard.writeText when available + returns true on success', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    (globalThis as Record<string, unknown>).window = {};
    (globalThis as Record<string, unknown>).document = {};
    (globalThis as Record<string, unknown>).navigator = {
      clipboard: { writeText: writeTextMock },
    };

    const { copyToClipboard } = await import('../copyToClipboard');
    const result = await copyToClipboard('hello world');

    expect(result).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('hello world');
  });

  it('falls back to document.execCommand when clipboard.writeText rejects', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('not focused'));
    const execCommandMock = vi.fn().mockReturnValue(true);
    const elementStub = {
      value: '',
      setAttribute: vi.fn(),
      select: vi.fn(),
      style: {},
    };

    (globalThis as Record<string, unknown>).window = {};
    (globalThis as Record<string, unknown>).document = {
      createElement: vi.fn().mockReturnValue(elementStub),
      execCommand: execCommandMock,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    };
    (globalThis as Record<string, unknown>).navigator = {
      clipboard: { writeText: writeTextMock },
    };

    const { copyToClipboard } = await import('../copyToClipboard');
    const result = await copyToClipboard('test');

    expect(result).toBe(true);
    expect(writeTextMock).toHaveBeenCalled();
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(elementStub.value).toBe('test');
  });

  it('returns false when both clipboard.writeText and execCommand fail', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('denied'));
    const execCommandMock = vi.fn().mockReturnValue(false);
    const elementStub = {
      value: '',
      setAttribute: vi.fn(),
      select: vi.fn(),
      style: {},
    };

    (globalThis as Record<string, unknown>).window = {};
    (globalThis as Record<string, unknown>).document = {
      createElement: vi.fn().mockReturnValue(elementStub),
      execCommand: execCommandMock,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    };
    (globalThis as Record<string, unknown>).navigator = {
      clipboard: { writeText: writeTextMock },
    };

    const { copyToClipboard } = await import('../copyToClipboard');
    const result = await copyToClipboard('test');

    expect(result).toBe(false);
  });

  it('falls back to execCommand when clipboard API is undefined (HTTP context)', async () => {
    const execCommandMock = vi.fn().mockReturnValue(true);
    const elementStub = {
      value: '',
      setAttribute: vi.fn(),
      select: vi.fn(),
      style: {},
    };

    (globalThis as Record<string, unknown>).window = {};
    (globalThis as Record<string, unknown>).document = {
      createElement: vi.fn().mockReturnValue(elementStub),
      execCommand: execCommandMock,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    };
    // No clipboard property on navigator
    (globalThis as Record<string, unknown>).navigator = {};

    const { copyToClipboard } = await import('../copyToClipboard');
    const result = await copyToClipboard('test');

    expect(result).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('cleans up the textarea (appendChild + removeChild called in pair)', async () => {
    const execCommandMock = vi.fn().mockReturnValue(true);
    const appendChildMock = vi.fn();
    const removeChildMock = vi.fn();
    const elementStub = {
      value: '',
      setAttribute: vi.fn(),
      select: vi.fn(),
      style: {},
    };

    (globalThis as Record<string, unknown>).window = {};
    (globalThis as Record<string, unknown>).document = {
      createElement: vi.fn().mockReturnValue(elementStub),
      execCommand: execCommandMock,
      body: { appendChild: appendChildMock, removeChild: removeChildMock },
    };
    (globalThis as Record<string, unknown>).navigator = {};

    const { copyToClipboard } = await import('../copyToClipboard');
    await copyToClipboard('cleanup-check');

    expect(appendChildMock).toHaveBeenCalledWith(elementStub);
    expect(removeChildMock).toHaveBeenCalledWith(elementStub);
  });

  it('returns false if execCommand throws (e.g. sandboxed iframe)', async () => {
    (globalThis as Record<string, unknown>).window = {};
    (globalThis as Record<string, unknown>).document = {
      createElement: vi.fn().mockImplementation(() => { throw new Error('blocked'); }),
      execCommand: vi.fn(),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    };
    (globalThis as Record<string, unknown>).navigator = {};

    const { copyToClipboard } = await import('../copyToClipboard');
    const result = await copyToClipboard('test');

    expect(result).toBe(false);
  });
});
