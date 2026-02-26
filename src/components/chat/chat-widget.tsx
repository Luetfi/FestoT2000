'use client';

import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ChatPanel } from './chat-panel';
import { useChat } from '@/hooks/use-chat';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, isLoading, sendMessage, clearMessages, stopGeneration } = useChat();

  return (
    <>
      {/* Chat overlay */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[420px] h-[600px] max-h-[80vh] max-w-[calc(100vw-3rem)] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground shrink-0">
            <span className="font-semibold text-sm">Festo Assistent</span>
            <div className="flex items-center gap-1">
              <button
                onClick={clearMessages}
                className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
                aria-label="Chat leeren"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
                aria-label="Chat schließen"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Chat panel */}
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSendMessage={sendMessage}
            onStopGeneration={stopGeneration}
          />
        </div>
      )}

      {/* Floating action button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setIsOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-full shadow-lg size-14 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              aria-label={isOpen ? 'Chat schließen' : 'Chat öffnen'}
            >
              {isOpen ? (
                <X className="size-6" />
              ) : (
                <img
                  src="/icons/white/artificial-intelligence-AI-32-w.png"
                  alt="KI-Chatbot Assistent"
                  width={32}
                  height={32}
                />
              )}
            </button>
          </TooltipTrigger>
          {!isOpen && (
            <TooltipContent side="left">
              KI-Chatbot Assistent
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </>
  );
}
