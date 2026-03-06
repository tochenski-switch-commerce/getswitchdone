/**
 * Authorized users list.
 * Only emails in this list can sign in. All users are admin level.
 */
export const AUTHORIZED_EMAILS: string[] = [
  'tochenski@switchcommerce.com',
  'vgardner@switchcommerce.com',
];

export function isAuthorizedEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return AUTHORIZED_EMAILS.includes(email.toLowerCase());
}
