import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' });

/** Cost-optimised model for all GSD AI features */
export const gsdModel = openai('gpt-4o-mini');

/* ── Auto-triage helper ── */

export interface TriageResult {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  summary: string;
  suggestedColumn?: string;
}

/**
 * Uses AI to classify incoming content (email / form submission) and
 * suggest a priority, summary and optional column placement.
 * Returns null if the AI call fails so callers can gracefully skip.
 */
export async function triageContent(input: {
  title: string;
  body: string;
  boardColumns?: string[];
}): Promise<TriageResult | null> {
  try {
    const result = await generateObject({
      model: gsdModel,
      schema: z.object({
        priority: z.enum(['low', 'medium', 'high', 'urgent']),
        summary: z.string(),
        suggestedColumn: z.string().optional(),
      }),
      prompt: [
        'Triage this incoming project item. Suggest a priority and write a one-line summary.',
        `Title: ${input.title}`,
        `Body: ${(input.body || '').slice(0, 1500)}`,
        input.boardColumns?.length
          ? `Available columns: ${input.boardColumns.join(', ')}`
          : '',
      ].filter(Boolean).join('\n'),
    });
    return result.object as TriageResult;
  } catch (err) {
    console.error('[ai-triage] Failed:', err);
    return null;
  }
}
