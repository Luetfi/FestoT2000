'use client';

import { useRef, useEffect, useState, useCallback, type KeyboardEvent } from 'react';
import { Send, Square, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMessageBubble } from './chat-message';
import type { ChatMessage } from '@/types/chat';

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  onStopGeneration: () => void;
}

export function ChatPanel({ messages, isLoading, onSendMessage, onStopGeneration }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, []);

  useEffect(() => {
    adjustTextarea();
  }, [input, adjustTextarea]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="size-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Festo Assistent</p>
              <p className="text-xs text-muted-foreground mt-1">
                Stelle mir eine Frage zu Festo-Produkten und ich finde passende Video-Anleitungen
                für dich.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t bg-background px-3 py-2.5 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Stelle eine Frage..."
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
          {isLoading ? (
            <Button
              variant="outline"
              size="icon"
              onClick={onStopGeneration}
              aria-label="Generierung stoppen"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="icon"
              onClick={handleSend}
              disabled={!input.trim()}
              aria-label="Nachricht senden"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
