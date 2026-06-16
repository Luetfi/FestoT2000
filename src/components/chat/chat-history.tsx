'use client';

import { MessageSquare, Trash2 } from 'lucide-react';
import type { Conversation } from '@/types/chat';

interface ChatHistoryProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onClearAll: () => void;
}

function formatRelativeDate(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return 'gerade eben';
  if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return new Date(timestamp).toLocaleDateString('de-DE');
}

export function ChatHistory({
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onClearAll,
}: ChatHistoryProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center px-6 gap-3">
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
          <MessageSquare className="size-6 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm">Noch keine Chats</p>
          <p className="text-xs text-muted-foreground mt-1">
            Deine Unterhaltungen werden hier automatisch gespeichert.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-1.5">
        {conversations.map((conversation) => {
          const isActive = conversation.id === activeConversationId;
          return (
            <div
              key={conversation.id}
              className={`group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                isActive ? 'border-primary/50 bg-primary/5' : 'hover:bg-accent'
              }`}
            >
              <button
                onClick={() => onSelectConversation(conversation.id)}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-sm font-medium truncate">
                  {conversation.title || 'Neuer Chat'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatRelativeDate(conversation.updatedAt)} · {conversation.messages.length}{' '}
                  Nachrichten
                </p>
              </button>
              <button
                onClick={() => onDeleteConversation(conversation.id)}
                className="shrink-0 p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                aria-label="Chat löschen"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="border-t px-3 py-2 shrink-0">
        <button
          onClick={onClearAll}
          className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1"
        >
          Alle Chats löschen
        </button>
      </div>
    </div>
  );
}
