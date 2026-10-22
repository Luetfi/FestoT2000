'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface QueryOutcomeLabels {
  question: string;
  yes: string;
  no: string;
  thanks: string;
}

interface QueryOutcomeProps {
  // Id of the query_log row this search produced; without it there is nothing to
  // attach the answer to, so the widget renders nothing.
  queryLogId: number | undefined;
  labels: QueryOutcomeLabels;
  className?: string;
}

type Status = 'idle' | 'sending' | 'done';

export function QueryOutcome({ queryLogId, labels, className }: QueryOutcomeProps) {
  const [status, setStatus] = useState<Status>('idle');

  if (queryLogId == null) return null;

  async function answer(wasSolved: boolean) {
    if (status !== 'idle') return;
    setStatus('sending');
    try {
      await fetch('/api/feedback/query', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryLogId, wasSolved }),
      });
    } catch {
      // best-effort
    }
    setStatus('done');
  }

  if (status === 'done') {
    return (
      <p className={cn('text-center text-sm text-muted-foreground', className)}>
        {labels.thanks}
      </p>
    );
  }

  return (
    <div className={cn('flex items-center justify-center gap-3 text-sm', className)}>
      <span className="text-muted-foreground">{labels.question}</span>
      <button
        type="button"
        disabled={status === 'sending'}
        onClick={() => answer(true)}
        className="rounded-full border border-border px-3 py-1 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        {labels.yes}
      </button>
      <button
        type="button"
        disabled={status === 'sending'}
        onClick={() => answer(false)}
        className="rounded-full border border-border px-3 py-1 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        {labels.no}
      </button>
    </div>
  );
}
