export async function register() {
  // Only validate on the server (not during edge/client builds)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];

    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
      console.error('[startup] Missing required environment variables:', missing.join(', '));
      // Log clearly but don't crash the server — let individual routes fail with context
    }

    const optional = [
      'OPENAI_API_KEY',
      'RESEND_API_KEY',
      'PUSH_WEBHOOK_SECRET',
    ];

    const missingOptional = optional.filter(k => !process.env[k]);
    if (missingOptional.length > 0) {
      console.warn('[startup] Optional env vars not set (some features may be unavailable):', missingOptional.join(', '));
    }
  }
}
