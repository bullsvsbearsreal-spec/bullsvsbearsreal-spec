import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getSessionId,
  getMessages,
  addMessage,
  updateLastAssistantMessage,
  clearChat,
} from '../chat';

const storage = new Map<string, string>();
const mockLS = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (i: number) => Array.from(storage.keys())[i] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLS, writable: true });
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

// Stable randomUUID for reproducible tests. vi.spyOn handles immutable
// crypto descriptors that direct assignment can't override on Node.
let uuidCounter = 0;
beforeEach(() => {
  storage.clear();
  uuidCounter = 0;
  vi.useRealTimers();
  vi.spyOn(crypto, 'randomUUID').mockImplementation((() => `uuid-${++uuidCounter}`) as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getSessionId', () => {
  it('creates a new session ID on first call', () => {
    const id = getSessionId();
    expect(id).toBe('uuid-1');
    expect(storage.get('ih_chat_session')).toBe('uuid-1');
  });

  it('returns the same session ID across calls (persisted)', () => {
    expect(getSessionId()).toBe('uuid-1');
    expect(getSessionId()).toBe('uuid-1');
  });
});

describe('addMessage + getMessages', () => {
  it('starts empty', () => {
    expect(getMessages()).toEqual([]);
  });

  it('adds a message with auto-generated id + timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T12:00:00Z'));
    const msg = addMessage({ role: 'user', content: 'Hello' });
    expect(msg.id).toBe('uuid-1');
    expect(msg.timestamp).toBe(new Date('2026-05-08T12:00:00Z').getTime());
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
    expect(getMessages()).toHaveLength(1);
  });

  it('preserves chronological order', () => {
    addMessage({ role: 'user', content: 'first' });
    addMessage({ role: 'assistant', content: 'second' });
    addMessage({ role: 'user', content: 'third' });
    const list = getMessages();
    expect(list.map(m => m.content)).toEqual(['first', 'second', 'third']);
  });

  it('caps stored messages at 50 (drops oldest)', () => {
    for (let i = 0; i < 60; i++) {
      addMessage({ role: 'user', content: `msg-${i}` });
    }
    const list = getMessages();
    expect(list.length).toBe(50);
    expect(list[0].content).toBe('msg-10');     // first 10 dropped
    expect(list[49].content).toBe('msg-59');
  });
});

describe('updateLastAssistantMessage — used during streaming', () => {
  it('updates the most recent assistant message content', () => {
    addMessage({ role: 'user', content: 'Q' });
    addMessage({ role: 'assistant', content: 'partial', isStreaming: true });
    updateLastAssistantMessage('full answer');
    const list = getMessages();
    expect(list[1].content).toBe('full answer');
    expect(list[1].isStreaming).toBe(false);
  });

  it('only updates the last assistant — leaves earlier ones', () => {
    addMessage({ role: 'assistant', content: 'first answer' });
    addMessage({ role: 'user', content: 'follow-up' });
    addMessage({ role: 'assistant', content: 'second answer' });
    updateLastAssistantMessage('updated second');
    const list = getMessages();
    expect(list[0].content).toBe('first answer');
    expect(list[2].content).toBe('updated second');
  });

  it('no-op when no assistant message exists', () => {
    addMessage({ role: 'user', content: 'only user' });
    updateLastAssistantMessage('should not appear');
    expect(getMessages().map(m => m.content)).toEqual(['only user']);
  });
});

describe('clearChat', () => {
  it('removes both messages and session', () => {
    addMessage({ role: 'user', content: 'hello' });
    getSessionId(); // create session
    expect(storage.has('ih_chat_messages')).toBe(true);
    expect(storage.has('ih_chat_session')).toBe(true);
    clearChat();
    expect(storage.has('ih_chat_messages')).toBe(false);
    expect(storage.has('ih_chat_session')).toBe(false);
  });
});

describe('defensive: bad localStorage data', () => {
  it('returns empty list on corrupt JSON', () => {
    storage.set('ih_chat_messages', '{not-json');
    expect(getMessages()).toEqual([]);
  });

  it('filters malformed messages (missing/wrong-type fields)', () => {
    const mixed = [
      { id: 'a', role: 'user', content: 'ok', timestamp: 1 },           // valid
      { id: 'b', role: 'system', content: 'bad role', timestamp: 1 },    // invalid role
      null,
      { id: 'c', role: 'assistant', content: 'ok', timestamp: 'soon' },  // bad ts
      { id: 'd', role: 'assistant', content: 'ok', timestamp: 2 },       // valid
    ];
    storage.set('ih_chat_messages', JSON.stringify(mixed));
    expect(getMessages().map(m => m.id)).toEqual(['a', 'd']);
  });
});
