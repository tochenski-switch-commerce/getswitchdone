import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' });

/** Cost-optimised model for all GSD AI features */
export const gsdModel = openai('gpt-4o-mini');
