// Amazon Bedrock access - server-only
// Text generation (Claude via an EU cross-region inference profile) and
// embeddings (Amazon Titan Text Embeddings V2). Credentials come from the
// default AWS provider chain - on EC2 the instance role, so no key is stored.
import 'server-only';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

const REGION = process.env.BEDROCK_REGION || 'eu-central-1';
// EU inference profile: requests stay inside EU regions.
export const CHAT_MODEL_ID =
  process.env.BEDROCK_CHAT_MODEL_ID || 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';
export const EMBEDDING_MODEL_ID =
  process.env.BEDROCK_EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0';
// Titan V2 supports 256, 512 or 1024; must match vector(...) in db/schema.sql.
export const EMBEDDING_DIMENSIONS = 1024;

let _client: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (_client) return _client;
  // Adaptive retries back off on throttling instead of failing the request.
  _client = new BedrockRuntimeClient({ region: REGION, maxAttempts: 5, retryMode: 'adaptive' });
  return _client;
}

export interface CompleteOptions {
  system: string;
  user: string;
  temperature: number;
  maxTokens?: number;
  /** Expect a JSON object; returns only the object text, ready for JSON.parse. */
  json?: boolean;
}

const JSON_INSTRUCTION =
  '\n\nAntworte ausschliesslich mit einem einzigen JSON-Objekt, ohne Erklaerung und ohne Markdown-Codeblock.';

/**
 * One-shot text generation with a system prompt and a single user message.
 */
export async function complete({
  system,
  user,
  temperature,
  maxTokens = 2000,
  json = false,
}: CompleteOptions): Promise<string> {
  const response = await getClient().send(
    new ConverseCommand({
      modelId: CHAT_MODEL_ID,
      system: [{ text: json ? system + JSON_INSTRUCTION : system }],
      messages: [{ role: 'user', content: [{ text: user }] }],
      inferenceConfig: { temperature, maxTokens },
    })
  );

  const text = (response.output?.message?.content ?? [])
    .map((block) => block.text ?? '')
    .join('')
    .trim();

  return json ? extractJsonObject(text) : text;
}

/**
 * Cut the JSON object out of a model answer. Claude follows the instruction
 * reliably, but may still wrap the object in a code fence or add a sentence.
 */
function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return text;
  return text.slice(start, end + 1);
}

/**
 * Embed one text with Titan Text Embeddings V2 (normalized vector).
 */
export async function embed(text: string): Promise<number[]> {
  const response = await getClient().send(
    new InvokeModelCommand({
      modelId: EMBEDDING_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ inputText: text, dimensions: EMBEDDING_DIMENSIONS, normalize: true }),
    })
  );
  const parsed = JSON.parse(new TextDecoder().decode(response.body)) as { embedding: number[] };
  return parsed.embedding;
}
