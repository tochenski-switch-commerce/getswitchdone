import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { readFileSync } from 'fs';

// Load .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = openai('gpt-4o-mini');

async function testSimple() {
  console.log('=== Test 1: Simple prompt (no tools) ===');
  console.log('API Key present:', !!process.env.OPENAI_API_KEY);

  const result = streamText({
    model,
    prompt: 'Say hello in one sentence.',
  });

  let text = '';
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      text += part.text;
      process.stdout.write(part.text);
    }
  }
  console.log('\nTotal text length:', text.length);
}

async function testWithTools() {
  console.log('\n\n=== Test 2: With tools + stepCountIs(5) ===');

  const result = streamText({
    model,
    prompt: 'What is the weather? After checking, tell me about it.',
    stopWhen: stepCountIs(5),
    tools: {
      getWeather: tool({
        description: 'Get current weather',
        inputSchema: z.object({}),
        execute: async () => ({ temp: 72, condition: 'sunny' }),
      }),
    },
  });

  let text = '';
  let parts = [];
  for await (const part of result.fullStream) {
    parts.push(part.type);
    if (part.type === 'text-delta') {
      text += part.text;
      process.stdout.write(part.text);
    }
  }
  console.log('\nTotal text length:', text.length);
  console.log('Part types seen:', [...new Set(parts)]);
}

try {
  await testSimple();
  await testWithTools();
} catch (err) {
  console.error('ERROR:', err.message);
  console.error(err);
}
