import { Resend } from 'resend';

/**
 * Server-side Resend client for sending emails.
 * Requires RESEND_API_KEY environment variable.
 * Import this only in server components / API routes.
 */
export const resend = new Resend(process.env.RESEND_API_KEY);
