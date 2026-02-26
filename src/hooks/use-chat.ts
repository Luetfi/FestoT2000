'use client';

import { useState, useRef, useCallback } from 'react';
import type { ChatMessage } from '@/types/chat';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Keep ref in sync for use in sendMessage without stale closures
  messagesRef.current = messages;

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    generationRef.current += 1;
    const thisGeneration = generationRef.current;

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
        // Stop if generation was invalidated (clear or new message)
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
  }, [isLoading]);

  const clearMessages = useCallback(() => {
    generationRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setIsLoading(false);
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    stopGeneration,
  };
}
