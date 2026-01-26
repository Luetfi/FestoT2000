// Inngest webhook handler
// This route receives events from Inngest and executes functions
import { serve } from 'inngest/next';
import { inngest, functions } from '@/lib/jobs/inngest';

// Create handler with all functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
