'use client';

import Link from 'next/link';
import { Play, Bot } from 'lucide-react';
import type { ChatMessage } from '@/types/chat';

// Matches: [📹 Title | Timestamp](/video/ID?segment=SID)
const VIDEO_LINK_REGEX = /\[📹\s*([^|]+?)\s*\|\s*([^\]]+?)\]\(\/video\/([^)]+)\)/g;

interface VideoRef {
  title: string;
  timestamp: string;
  href: string;
}

function parseVideoRefs(text: string): { parts: string[]; refs: (VideoRef | null)[] } {
  const parts: string[] = [];
  const refs: (VideoRef | null)[] = [];
  let lastIndex = 0;

  const regex = new RegExp(VIDEO_LINK_REGEX.source, 'g');
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
      refs.push(null);
    }

    // The video reference
    parts.push('');
    refs.push({
      title: match[1].trim(),
      timestamp: match[2].trim(),
      href: `/video/${match[3]}`,
    });

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
    refs.push(null);
  }

  return { parts, refs };
}

function VideoRefCard({ ref: videoRef }: { ref: VideoRef }) {
  return (
    <Link
      href={videoRef.href}
      className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs hover:bg-accent transition-colors my-0.5"
    >
      <Play className="size-3 text-primary shrink-0" />
      <span className="font-medium truncate max-w-[200px]">{videoRef.title}</span>
      <span className="text-muted-foreground">{videoRef.timestamp}</span>
    </Link>
  );
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-3.5 py-2.5 text-sm whitespace-pre-line">
          {message.content}
        </div>
      </div>
    );
  }

  const { parts, refs } = parseVideoRefs(message.content);

  return (
    <div className="flex gap-2 items-start">
      <div className="shrink-0 size-7 rounded-full bg-muted flex items-center justify-center mt-0.5">
        <Bot className="size-4 text-muted-foreground" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm">
        {parts.map((part, i) => {
          const ref = refs[i];
          if (ref) {
            return <VideoRefCard key={i} ref={ref} />;
          }
          if (part) {
            return (
              <span key={i} className="whitespace-pre-line">
                {part}
              </span>
            );
          }
          return null;
        })}
        {!message.content && (
          <span className="inline-flex gap-1">
            <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" />
            <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.15s]" />
            <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.3s]" />
          </span>
        )}
      </div>
    </div>
  );
}
