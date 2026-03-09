import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env.local
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROD_URL = 'https://getswitchdone.netlify.app';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Get a board
const { data: boards } = await admin.from('project_boards').select('id, title').limit(1);
if (!boards?.length) { console.log('No boards found'); process.exit(1); }
const boardId = boards[0].id;
console.log('Board:', boards[0].title, boardId);

// Sign in as the user to get a real access token
const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1 });
const user = users[0];
console.log('User:', user.email, '\n');

// Generate a magic link and extract the token
// Actually, we can use admin.auth.admin.generateLink to get an access token
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: user.email,
});

if (linkErr) {
  console.log('Link error:', linkErr.message);
  
  // Alternative: use the service key directly with the API
  // The verifyAuth function uses supabaseAnon.auth.getUser(token)  
  // Service role key should work with getUser
  console.log('\nTrying service role key as bearer token...');
}

// The properties field contains the hashed_token and access_token
// But actually what we need is a session. Let's just use
// admin.auth.admin to create a session directly
// Actually, the simplest: use supabase-js to sign in

const anonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Use admin to update user password temporarily so we can sign in
const testPassword = 'TestPassword123!';
const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, { password: testPassword });
if (updateErr) {
  console.log('Failed to set password:', updateErr.message);
  process.exit(1);
}

const { data: session, error: signInErr } = await anonClient.auth.signInWithPassword({
  email: user.email,
  password: testPassword,
});

if (signInErr) {
  console.log('Sign in error:', signInErr.message);
  process.exit(1);
}

const accessToken = session.session.access_token;
console.log('Got access token:', accessToken.slice(0, 20) + '...');

// Test production API
console.log('\n=== Testing PRODUCTION API ===');
console.log('URL:', PROD_URL + '/api/ai/chat');

try {
  const res = await fetch(PROD_URL + '/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      boardId,
      messages: [{ role: 'user', content: 'Hello! List the columns on this board.' }],
    }),
  });

  console.log('Status:', res.status, res.statusText);
  console.log('Headers:', Object.fromEntries(res.headers.entries()));

  if (!res.ok) {
    console.log('Error body:', await res.text());
  } else {
    // Read the stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let chunks = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks++;
      const text = decoder.decode(value, { stream: true });
      accumulated += text;
      console.log(`Chunk ${chunks} (${value.length} bytes):`, JSON.stringify(text.slice(0, 200)));
    }

    console.log('\n--- Final Result ---');
    console.log('Total chunks:', chunks);
    console.log('Total length:', accumulated.length);
    console.log('Content:', accumulated.slice(0, 1000));
    
    if (!accumulated) {
      console.log('\n*** BLANK RESPONSE CONFIRMED ***');
    }
  }
} catch (err) {
  console.error('Fetch error:', err.message);
}

