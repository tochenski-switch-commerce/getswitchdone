import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/email/test-inbound
 * Development-only helper to simulate a forwarded email.
 * Calls the real inbound webhook handler internally.
 *
 * Body: { from: string, subject: string, body: string }
 * Returns: the routing result from the inbound handler
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const { from, subject, body } = await request.json() as {
      from?: string;
      subject?: string;
      body?: string;
    };

    if (!from) {
      return NextResponse.json({ error: 'Missing "from" field' }, { status: 400 });
    }

    // Build a Resend-like wrapped payload
    const payload = {
      type: 'email.received',
      created_at: new Date().toISOString(),
      data: {
        email_id: `test-${Date.now()}`,
        from: from,
        to: ['gsd@localhost'],
        subject: subject || '(no subject)',
        message_id: `<test-${Date.now()}@localhost>`,
      },
    };

    // Call the real inbound endpoint
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const inboundUrl = `${protocol}://${host}/api/email/inbound`;

    const inboundHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.INBOUND_EMAIL_SECRET) {
      inboundHeaders['Authorization'] = `Bearer ${process.env.INBOUND_EMAIL_SECRET}`;
    }

    // For test emails, also pass body directly since we won't have an email_id in Resend
    // Override the payload to include text/html in data for test purposes
    const testPayload = {
      ...payload,
      data: {
        ...payload.data,
        text: body || '',
        html: body ? `<p>${body.replace(/\n/g, '<br/>')}</p>` : '',
      },
    };

    const result = await fetch(inboundUrl, {
      method: 'POST',
      headers: inboundHeaders,
      body: JSON.stringify(testPayload),
    });

    const data = await result.json();
    return NextResponse.json({
      test: true,
      status: result.status,
      ...data,
    });
  } catch (err: unknown) {
    console.error('Test inbound error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
