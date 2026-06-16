'use client';

import { useState } from 'react';
import { X, History, SquarePen, ArrowLeft } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ChatPanel } from './chat-panel';
import { ChatHistory } from './chat-history';
import { useChat } from '@/hooks/use-chat';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const {
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
  } = useChat();

  const handleNewConversation = () => {
    newConversation();
    setView('chat');
  };

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    setView('chat');
  };

  return (
    <>
      {/* Chat overlay */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[420px] h-[600px] max-h-[80vh] max-w-[calc(100vw-3rem)] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-primary text-primary-foreground shrink-0">
            <span className="font-semibold text-sm truncate">
              {view === 'history' ? 'Chatverlauf' : title || 'Festo Assistent'}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setView((prev) => (prev === 'history' ? 'chat' : 'history'))}
                className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
                aria-label={view === 'history' ? 'Zurück zum Chat' : 'Chatverlauf öffnen'}
              >
                {view === 'history' ? (
                  <ArrowLeft className="size-4" />
                ) : (
                  <History className="size-4" />
                )}
              </button>
              <button
                onClick={handleNewConversation}
                className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
                aria-label="Neuer Chat"
              >
                <SquarePen className="size-4" />
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

          {/* Content */}
          {view === 'history' ? (
            <ChatHistory
              conversations={conversations}
              activeConversationId={conversationId}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={deleteConversation}
              onClearAll={clearAllConversations}
            />
          ) : (
            <ChatPanel
              messages={messages}
              isLoading={isLoading}
              onSendMessage={sendMessage}
              onStopGeneration={stopGeneration}
            />
          )}
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
