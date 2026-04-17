import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as http2 from 'http2';
import * as crypto from 'crypto';
import webpush from 'web-push';
import { normalizeNotificationText } from '@/lib/notification-text';

if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@lumio.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

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
  const cleanTitle = normalizeNotificationText(title) || 'Lumio';
  const cleanBody = normalizeNotificationText(body) || 'You have a new notification';

  if (!user_id || !cleanTitle) {
    return NextResponse.json({ error: 'Missing user_id or title' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Get device tokens for target user
  const { data: tokens } = await supabaseAdmin
    .from('device_tokens')
    .select('token, platform')
    .eq('user_id', user_id);

  const apnsReady = !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY);
  const iosTokens = apnsReady ? (tokens ?? []).filter(t => t.platform === 'ios') : [];

  // Get actual unread notification count for this user
  const { count: unreadCount } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .eq('is_read', false);

  const payload = {
    aps: {
      alert: { title: cleanTitle, body: cleanBody },
      sound: 'default',
      badge: (unreadCount ?? 0) + 1, // +1 for the notification being created
      'content-available': 1, // trigger background fetch so widget refreshes
    },
    type,
    board_id,
    card_id,
  };

  const apnsResults = await Promise.allSettled(
    iosTokens.map(t => sendApnsPush(t.token, payload, user_id, supabaseAdmin))
  );
  const apnsSent = apnsResults.filter(r => r.status === 'fulfilled' && r.value).length;

  // ── Web Push ──────────────────────────────────────────────────────────────
  const webPayload = JSON.stringify({ title: cleanTitle, body: cleanBody, type, board_id, card_id });
  const { data: webSubs } = await supabaseAdmin
    .from('web_push_subscriptions')
    .select('endpoint, p256dh, auth, id')
    .eq('user_id', user_id);

  let webSent = 0;
  if (webSubs && webSubs.length > 0 && process.env.VAPID_PRIVATE_KEY) {
    const webResults = await Promise.allSettled(
      webSubs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            webPayload
          );
          return true;
        } catch (err: unknown) {
          // 410 Gone = subscription expired, clean it up
          if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
            await supabaseAdmin.from('web_push_subscriptions').delete().eq('id', sub.id);
          }
          return false;
        }
      })
    );
    webSent = webResults.filter(r => r.status === 'fulfilled' && r.value).length;
  }

  return NextResponse.json({ sent: apnsSent + webSent, apns: apnsSent, web: webSent });
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
