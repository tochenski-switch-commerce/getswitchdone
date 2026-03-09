import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env.local
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role to find a board ID and a user
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Get a board
const { data: boards } = await admin.from('project_boards').select('id, title').limit(1);
if (!boards?.length) { console.log('No boards found'); process.exit(1); }
const boardId = boards[0].id;
console.log('Using board:', boards[0].title, boardId);

// Get a user to sign in as
const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1 });
if (!users?.length) { console.log('No users found'); process.exit(1); }
const user = users[0];
console.log('Using user:', user.email);

// Generate a session token for this user
const { data: sessionData, error: sessionError } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: user.email,
});

// Actually, let's just use the service role key directly as the bearer since verifyAuth
// uses supabaseAnon.auth.getUser(token). Let's see what happens with anon key approach.

// We need a real session. Let's check if we can use signInWithPassword or OTP.
// Alternative: bypass auth by temporarily testing with a direct call.

// Let's first test without auth to see the actual error
console.log('\n--- Test 1: No auth (should return 401) ---');
const res1 = await fetch('http://localhost:3000/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    boardId,
    messages: [{ role: 'user', content: 'Hello, what cards are on this board?' }],
  }),
});
console.log('Status:', res1.status);
console.log('Body:', await res1.text());

// Test with service role key as bearer (won't work for auth.getUser but let's see)
console.log('\n--- Test 2: With service role key (should fail auth) ---');
const res2 = await fetch('http://localhost:3000/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({
    boardId,
    messages: [{ role: 'user', content: 'Hello, what cards are on this board?' }],
  }),
});
console.log('Status:', res2.status);
const body2 = await res2.text();
console.log('Body length:', body2.length);
console.log('Body preview:', body2.slice(0, 500));
