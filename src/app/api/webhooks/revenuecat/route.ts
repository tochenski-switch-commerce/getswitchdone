import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * RevenueCat webhook handler.
 * Syncs subscription state from RevenueCat → user_subscriptions table.
 *
 * Webhook docs: https://www.revenuecat.com/docs/integrations/webhooks
 */
export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret
    const authHeader = req.headers.get('authorization');
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const event = body.event;

    if (!event) {
      return NextResponse.json({ error: 'Missing event' }, { status: 400 });
    }

    const appUserId = event.app_user_id as string;
    const eventType = event.type as string;

    // app_user_id should be the Supabase user UUID (set during SDK configure/login)
    if (!appUserId) {
      return NextResponse.json({ error: 'Missing app_user_id' }, { status: 400 });
    }

    // Don't override staff grants
    const { data: existing } = await supabaseAdmin
      .from('user_subscriptions')
      .select('is_staff_grant')
      .eq('user_id', appUserId)
      .single();

    if (existing?.is_staff_grant) {
      return NextResponse.json({ ok: true, skipped: 'staff_grant' });
    }

    // Map RevenueCat event types to subscription state
    let entitlement: string;
    let status: string;

    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'NON_RENEWING_PURCHASE':
        entitlement = 'pro';
        status = 'active';
        break;

      case 'CANCELLATION':
        // Still active until period end, just won't renew
        entitlement = 'pro';
        status = 'canceled';
        break;

      case 'EXPIRATION':
        entitlement = 'free';
        status = 'expired';
        break;

      case 'BILLING_ISSUE':
        entitlement = 'pro';
        status = 'grace_period';
        break;

      case 'PRODUCT_CHANGE':
        entitlement = 'pro';
        status = 'active';
        break;

      default:
        // Unknown event type — acknowledge but don't update
        return NextResponse.json({ ok: true, ignored: eventType });
    }

    const productId = event.product_id ?? null;
    const store = event.store as string | undefined;
    const platform = store === 'APP_STORE' ? 'ios' : store === 'STRIPE' ? 'stripe' : store?.toLowerCase() ?? null;
    const isSandbox = event.environment === 'SANDBOX';
    const periodStart = event.purchased_at_ms ? new Date(event.purchased_at_ms).toISOString() : null;
    const periodEnd = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;

    const { error } = await supabaseAdmin
      .from('user_subscriptions')
      .upsert({
        user_id: appUserId,
        revenuecat_app_user_id: event.original_app_user_id ?? appUserId,
        entitlement,
        product_id: productId,
        platform,
        status,
        is_sandbox: isSandbox,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        raw_data: body,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Webhook upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, event: eventType, user: appUserId });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
