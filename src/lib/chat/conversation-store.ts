// Conversation store - client-only localStorage persistence for chat history.
// There are no per-user accounts (shared team login), so conversations live
// in the browser. All functions are SSR-safe no-ops when window is missing
// and swallow storage errors so the chat keeps working without persistence.
import type { Conversation } from '@/types/chat';

const STORAGE_KEY = 'festo-chat-conversations';
const STORAGE_VERSION = 1;
const MAX_CONVERSATIONS = 30;

interface StoredData {
  version: number;
  conversations: Conversation[];
}

function readStore(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredData;
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.conversations)) {
      return [];
    }
    return parsed.conversations;
  } catch {
    return [];
  }
}

function writeStore(conversations: Conversation[]): void {
  if (typeof window === 'undefined') return;
  // Newest first, capped; on quota errors keep dropping the oldest and retry.
  let toStore = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONVERSATIONS);

  while (true) {
    try {
      const data: StoredData = { version: STORAGE_VERSION, conversations: toStore };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return;
    } catch {
      if (toStore.length === 0) return;
      toStore = toStore.slice(0, toStore.length - 1);
    }
  }
}

/**
 * All stored conversations, newest first.
 */
export function loadConversations(): Conversation[] {
  return readStore().sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Insert or update a conversation.
 */
export function saveConversation(conversation: Conversation): void {
  const rest = readStore().filter((c) => c.id !== conversation.id);
  writeStore([conversation, ...rest]);
}

export function deleteConversation(id: string): void {
  writeStore(readStore().filter((c) => c.id !== id));
}

export function clearConversations(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore - nothing to clean up if storage is unavailable.
  }
}
