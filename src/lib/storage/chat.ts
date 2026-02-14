/**
 * Chat message history stored in localStorage.
 * Key: ih_chat_messages
 * Session ID stored separately: ih_chat_session
 */

const MESSAGES_KEY = 'ih_chat_messages';
const SESSION_KEY = 'ih_chat_session';
const MAX_STORED_MESSAGES = 50;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

function readMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChatMessage =>
        typeof m === 'object' &&
        m !== null &&
        typeof m.id === 'string' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        typeof m.timestamp === 'number',
    );
  } catch {
    return [];
  }
}

function writeMessages(messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep only the last N messages
    const trimmed = messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable
  }
}

/** Get the current session ID, creating one if needed. */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Return all stored chat messages. */
export function getMessages(): ChatMessage[] {
  return readMessages();
}

/** Add a message to chat history. */
export function addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
  const full: ChatMessage = {
    ...message,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const messages = readMessages();
  messages.push(full);
  writeMessages(messages);
  return full;
}

/** Update the last assistant message (used during streaming). */
export function updateLastAssistantMessage(content: string): void {
  const messages = readMessages();
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      messages[i].content = content;
      messages[i].isStreaming = false;
      writeMessages(messages);
      return;
    }
  }
}

/** Clear all chat messages and reset the session. */
export function clearChat(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(MESSAGES_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // silently ignore
  }
}
