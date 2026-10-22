import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Trim segment text so it starts at a sentence boundary.
 * If the text begins mid-sentence (first character is lowercase),
 * finds the first sentence boundary and trims to it.
 * Returns the original text if it already starts cleanly.
 */
export function trimToSentenceStart(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  // Already starts with uppercase, digit, or opening quote → likely sentence start
  if (/^[A-ZÄÖÜ0-9"„«(\[]/.test(trimmed)) return trimmed;

  // Starts mid-sentence → find first sentence boundary (punctuation + space + uppercase)
  const match = trimmed.match(/[.!?]\s+([A-ZÄÖÜ0-9"„«])/);
  if (match && match.index !== undefined) {
    const sentenceStart = match.index + match[0].length - 1;
    // Only trim if we keep at least 60% of the text
    if (sentenceStart < trimmed.length * 0.4) {
      return trimmed.slice(sentenceStart);
    }
  }

  // No good boundary found → return as-is
  return trimmed;
}
