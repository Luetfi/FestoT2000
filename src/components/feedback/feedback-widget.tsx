'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FeedbackType } from '@/lib/supabase/types';

export const FEEDBACK_REASONS = [
  'not_relevant',
  'wrong_topic',
  'too_basic',
  'bad_quality',
  'other',
] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

export interface FeedbackWidgetLabels {
  question: string;
  helpful: string;
  notHelpful: string;
  thanks: string;
  reasons: Record<FeedbackReason, string>;
}

interface FeedbackWidgetProps {
  videoId: number;
  feedbackType: FeedbackType;
  segmentId?: number;
  query?: string;
  lang: string;
  labels: FeedbackWidgetLabels;
  className?: string;
}

type Status = 'idle' | 'sending' | 'reasons' | 'done';

export function FeedbackWidget({
  videoId,
  feedbackType,
  segmentId,
  query,
  lang,
  labels,
  className,
}: FeedbackWidgetProps) {
  const [status, setStatus] = useState<Status>('idle');

  async function send(isPositive: boolean, reason?: FeedbackReason) {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, segmentId, feedbackType, isPositive, query, reason, lang }),
      });
    } catch {
      // Feedback is best-effort; never disrupt the UI on failure.
    }
  }

  function handleVote(isPositive: boolean) {
    if (status === 'sending') return;
    setStatus('sending');
    void send(isPositive).then(() => {
      // Negative votes reveal optional reason chips; positive ones just thank.
      setStatus(isPositive ? 'done' : 'reasons');
    });
  }

  function handleReason(reason: FeedbackReason) {
    setStatus('done');
    void send(false, reason);
  }

  if (status === 'done') {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>{labels.thanks}</p>
    );
  }

  if (status === 'reasons') {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
        <span className="text-xs text-muted-foreground mr-1">{labels.thanks}</span>
        {FEEDBACK_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => handleReason(r)}
            className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            {labels.reasons[r]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs text-muted-foreground">{labels.question}</span>
      <button
        type="button"
        aria-label={labels.helpful}
        title={labels.helpful}
        disabled={status === 'sending'}
        onClick={() => handleVote(true)}
        className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-green-600 disabled:opacity-50"
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={labels.notHelpful}
        title={labels.notHelpful}
        disabled={status === 'sending'}
        onClick={() => handleVote(false)}
        className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
      >
        <ThumbsDown className="size-3.5" />
      </button>
    </div>
  );
}
