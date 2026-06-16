'use client';

import { Loader2 } from 'lucide-react';
import { formatTimeRange } from '@/types/search';
import { FeedbackWidget, type FeedbackWidgetLabels } from '@/components/feedback/feedback-widget';

interface ExplanationState {
  status: 'loading' | 'loaded' | 'error';
  text?: string;
}

interface Segment {
  id: string;
  text: string;
  summary: string | null;
  start_time: number;
  end_time: number;
}

interface AnswerPanelProps {
  segment: Segment | null;
  explanation: ExplanationState | undefined;
  videoId: number;
  lang: string;
  feedbackLabels: FeedbackWidgetLabels;
  labels: {
    yourAnswer: string;
    generatingExplanation: string;
    explanationError: string;
  };
}

export function AnswerPanel({
  segment,
  explanation,
  videoId,
  lang,
  feedbackLabels,
  labels,
}: AnswerPanelProps) {
  if (!segment) return null;

  return (
    <div className="border rounded-lg p-6 bg-accent/10 h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-1">{labels.yourAnswer}</h2>
      <p className="text-xs text-muted-foreground mb-4">
        {formatTimeRange(segment.start_time, segment.end_time)}
      </p>

      <div className="flex-1 overflow-y-auto">
        {explanation?.status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {labels.generatingExplanation}
          </div>
        )}
        {explanation?.status === 'error' && (
          <p className="text-sm text-destructive">{labels.explanationError}</p>
        )}
        {explanation?.status === 'loaded' && (
          <p className="text-[0.925rem] leading-relaxed text-foreground whitespace-pre-line">
            {explanation.text}
          </p>
        )}
        {!explanation && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {labels.generatingExplanation}
          </div>
        )}
      </div>

      {/* Editorial signal: does this video fit the topic? (general, not query-bound) */}
      <div className="mt-4 border-t pt-4">
        <FeedbackWidget
          videoId={videoId}
          feedbackType="video"
          segmentId={Number(segment.id)}
          lang={lang}
          labels={feedbackLabels}
        />
      </div>
    </div>
  );
}
