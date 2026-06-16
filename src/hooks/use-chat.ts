'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChatMessage, Conversation } from '@/types/chat';
import {
  loadConversations,
  saveConversation,
  deleteConversation as deleteStoredConversation,
  clearConversations,
} from '@/lib/chat/conversation-store';

const SAVE_DEBOUNCE_MS = 300;
const FALLBACK_TITLE_CHARS = 40;

function fallbackTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((m) => m.role === 'user' && m.content.length > 0);
  return firstUserMessage ? firstUserMessage.content.slice(0, FALLBACK_TITLE_CHARS) : '';
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const messagesRef = useRef<ChatMessage[]>([]);
  const conversationIdRef = useRef('');
  const titleRef = useRef('');
  const createdAtRef = useRef(0);

  // Keep refs in sync for use in sendMessage without stale closures
  messagesRef.current = messages;
  conversationIdRef.current = conversationId;
  titleRef.current = title;

  // On mount: resume the most recent conversation, or start a fresh one
  useEffect(() => {
    const stored = loadConversations();
    setConversations(stored);

    const latest = stored[0];
    if (latest) {
      setConversationId(latest.id);
      setTitle(latest.title);
      setMessages(latest.messages);
      createdAtRef.current = latest.createdAt;
    } else {
      setConversationId(crypto.randomUUID());
      createdAtRef.current = Date.now();
    }
  }, []);

  // Persist the current conversation (debounced; streaming updates collapse)
  useEffect(() => {
    if (!conversationId) return;
    const complete = messages.filter((m) => m.content.length > 0);
    if (complete.length === 0) return;

    const timer = setTimeout(() => {
      saveConversation({
        id: conversationId,
        title: title || fallbackTitle(complete),
        createdAt: createdAtRef.current,
        updatedAt: Date.now(),
        messages: complete,
      });
      setConversations(loadConversations());
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [messages, title, conversationId]);

  const fetchTitle = useCallback(async (question: string, answer: string) => {
    const forConversation = conversationIdRef.current;
    try {
      const response = await fetch('/api/chat/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as { title?: string | null };
      // Only apply if the user hasn't switched conversations meanwhile
      if (data.title && conversationIdRef.current === forConversation) {
        setTitle(data.title);
      }
    } catch {
      // Fallback title (truncated first question) stays in place
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    generationRef.current += 1;
    const thisGeneration = generationRef.current;
    const isFirstExchange = messagesRef.current.filter((m) => m.content.length > 0).length === 0;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let assistantContent = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          history: messagesRef.current.filter((m) => m.content.length > 0),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        // Stop if generation was invalidated (conversation switch or new message)
        if (generationRef.current !== thisGeneration) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (generationRef.current !== thisGeneration) break;

          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              assistantContent += parsed.content;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: msg.content + parsed.content }
                    : msg
                )
              );
            }
            if (parsed.error) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: msg.content + '\n\nFehler: ' + parsed.error }
                    : msg
                )
              );
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Generate an AI title once the first exchange of a conversation completed
      if (generationRef.current === thisGeneration && isFirstExchange && assistantContent) {
        void fetchTitle(userMessage.content, assistantContent);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      // Only set error if this generation is still active
      if (generationRef.current === thisGeneration) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  content:
                    msg.content ||
                    'Es tut mir leid, es ist ein Fehler aufgetreten. Bitte versuche es erneut.',
                }
              : msg
          )
        );
      }
    } finally {
      if (generationRef.current === thisGeneration) {
        setIsLoading(false);
      }
      abortControllerRef.current = null;
    }
  }, [isLoading, fetchTitle]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  // Invalidate any running generation and reset transient state
  const resetGeneration = useCallback(() => {
    generationRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  // Save the active conversation immediately; the debounced effect would lose
  // the latest messages when the conversation switches before it fires.
  const flushSave = useCallback(() => {
    const complete = messagesRef.current.filter((m) => m.content.length > 0);
    if (!conversationIdRef.current || complete.length === 0) return;
    saveConversation({
      id: conversationIdRef.current,
      title: titleRef.current || fallbackTitle(complete),
      createdAt: createdAtRef.current,
      updatedAt: Date.now(),
      messages: complete,
    });
  }, []);

  // Reset to a fresh empty conversation without touching the store
  const startFresh = useCallback(() => {
    resetGeneration();
    setConversationId(crypto.randomUUID());
    setTitle('');
    setMessages([]);
    createdAtRef.current = Date.now();
  }, [resetGeneration]);

  const newConversation = useCallback(() => {
    flushSave();
    startFresh();
    setConversations(loadConversations());
  }, [flushSave, startFresh]);

  const selectConversation = useCallback(
    (id: string) => {
      const conversation = loadConversations().find((c) => c.id === id);
      if (!conversation) return;
      resetGeneration();
      flushSave();
      setConversationId(conversation.id);
      setTitle(conversation.title);
      setMessages(conversation.messages);
      createdAtRef.current = conversation.createdAt;
      setConversations(loadConversations());
    },
    [resetGeneration, flushSave]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      // Reset first when deleting the active chat - flushing afterwards would
      // write the deleted conversation right back into the store.
      if (id === conversationIdRef.current) {
        startFresh();
      }
      deleteStoredConversation(id);
      setConversations(loadConversations());
    },
    [startFresh]
  );

  const clearAllConversations = useCallback(() => {
    startFresh();
    clearConversations();
    setConversations([]);
  }, [startFresh]);

  return {
    messages,
    isLoading,
    conversationId,
    title,
    conversations,
    sendMessage,
    stopGeneration,
    newConversation,
    selectConversation,
    deleteConversation,
    clearAllConversations,
  };
}
