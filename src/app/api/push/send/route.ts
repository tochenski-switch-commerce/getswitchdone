import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as http2 from 'http2';
import * as crypto from 'crypto';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );
}

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get('x-push-secret');
  if (!secret || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { user_id, title, body, type, board_id, card_id } = await req.json();

  if (!user_id || !title) {
    return NextResponse.json({ error: 'Missing user_id or title' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Get device tokens for target user
  const { data: tokens } = await supabaseAdmin
    .from('device_tokens')
    .select('token, platform')
    .eq('user_id', user_id);

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Check if APNs is configured
  if (!process.env.APNS_KEY_ID || !process.env.APNS_TEAM_ID || !process.env.APNS_PRIVATE_KEY) {
    return NextResponse.json({ sent: 0, reason: 'apns_not_configured' });
  }

  const iosTokens = tokens.filter(t => t.platform === 'ios');

  // Get actual unread notification count for this user
  const { count: unreadCount } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .eq('is_read', false);

  const payload = {
    aps: {
      alert: { title, body: body || '' },
      sound: 'default',
      badge: (unreadCount ?? 0) + 1, // +1 for the notification being created
      'content-available': 1, // trigger background fetch so widget refreshes
    },
    type,
    board_id,
    card_id,
  };

  const results = await Promise.allSettled(
    iosTokens.map(t => sendApnsPush(t.token, payload, user_id, supabaseAdmin))
  );

  const sent = results.filter(r => r.status === 'fulfilled' && r.value).length;
  return NextResponse.json({ sent });
}

// ── APNs JWT ──

function generateApnsJwt(): string {
  const header = { alg: 'ES256', kid: process.env.APNS_KEY_ID! };
  const claims = { iss: process.env.APNS_TEAM_ID!, iat: Math.floor(Date.now() / 1000) };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const claimsB64 = Buffer.from(JSON.stringify(claims)).toString('base64url');

  const privateKey = Buffer.from(process.env.APNS_PRIVATE_KEY!, 'base64').toString('utf8');
  const signer = crypto.createSign('SHA256');
  signer.update(`${headerB64}.${claimsB64}`);
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }, 'base64url');

  return `${headerB64}.${claimsB64}.${signature}`;
}

// ── APNs HTTP/2 send ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendApnsPush(deviceToken: string, payload: object, userId: string, db: any): Promise<boolean> {
  const host = process.env.APNS_ENVIRONMENT === 'production'
    ? 'api.push.apple.com'
    : 'api.sandbox.push.apple.com';

  const bundleId = process.env.APNS_BUNDLE_ID || 'com.getswitchdone.boards';

  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);

    client.on('error', () => {
      client.close();
      resolve(false);
    });

    const jwt = generateApnsJwt();
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'authorization': `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    });

    let status = 0;
    req.on('response', (headers) => {
      status = headers[':status'] as number;
    });

    let responseData = '';
    req.on('data', (chunk) => { responseData += chunk; });

    req.on('end', async () => {
      client.close();
      // 410 Gone = token is no longer valid, clean it up
      if (status === 410) {
        await db
          .from('device_tokens')
          .delete()
          .eq('user_id', userId)
          .eq('token', deviceToken);
      }
      resolve(status === 200);
    });

    req.on('error', () => {
      client.close();
      resolve(false);
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}
