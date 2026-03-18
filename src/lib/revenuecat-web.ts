/**
 * RevenueCat Web SDK integration (@revenuecat/purchases-js).
 * Handles Stripe-based web subscriptions via RevenueCat's Web Billing.
 * On native (iOS), this module is not used — see revenuecat.ts instead.
 *
 * SDK docs: https://www.revenuecat.com/docs/getting-started/installation/web-sdk
 */
import { Purchases, type Package, type CustomerInfo, type PurchaseResult, type Offering } from '@revenuecat/purchases-js';
import { Capacitor } from '@capacitor/core';
import { RC_WEB_API_KEY, RC_ENTITLEMENT } from '@/lib/plan-config';

let configured = false;

/**
 * Configure the SDK once with a user ID.
 * Call this after authentication.
 */
export function configureWebPurchases(appUserId: string): typeof Purchases | null {
  if (Capacitor.isNativePlatform()) return null;
  if (!RC_WEB_API_KEY) {
    console.warn('NEXT_PUBLIC_REVENUECAT_API_KEY_WEB not configured');
    return null;
  }

  Purchases.configure({ apiKey: RC_WEB_API_KEY, appUserId });
  configured = true;
  return Purchases;
}

/** Get the shared instance (must be configured first). */
function getSharedInstance() {
  if (!configured) return null;
  try {
    return Purchases.getSharedInstance();
  } catch {
    return null;
  }
}

export const isWeb = () => !Capacitor.isNativePlatform();

/**
 * Switch user after login. Re-configures the SDK with the new user ID.
 */
export function loginRevenueCatWeb(userId: string) {
  if (!isWeb()) return;
  configureWebPurchases(userId);
}

/**
 * Reset on logout. Next login will re-configure.
 */
export function logoutRevenueCatWeb() {
  configured = false;
}

/**
 * Fetch offerings. Returns the current (default) offering.
 */
export async function getWebOfferings(): Promise<Offering | null> {
  const purchases = getSharedInstance();
  if (!purchases) return null;

  try {
    const offerings = await purchases.getOfferings();
    return offerings.current;
  } catch (err) {
    console.error('Failed to get web offerings:', err);
    return null;
  }
}

/**
 * Purchase a package via RevenueCat Web Billing (Stripe).
 * The SDK renders a checkout UI into the provided DOM element.
 */
export async function purchaseWebPackage(
  pkg: Package,
  htmlTarget?: HTMLElement,
): Promise<PurchaseResult | null> {
  const purchases = getSharedInstance();
  if (!purchases) return null;

  try {
    const result = await purchases.purchase({
      rcPackage: pkg,
      ...(htmlTarget ? { htmlTarget } : {}),
    });
    return result;
  } catch (err: any) {
    // User cancelled — not an error
    if (err?.userCancelled) return null;
    throw err;
  }
}

/**
 * Present the RevenueCat-hosted paywall UI.
 * Renders into the provided DOM element. Returns purchase result on completion.
 * Requires @revenuecat/purchases-js >= 0.19.0
 */
export async function presentWebPaywall(
  htmlTarget: HTMLElement,
  offering?: Offering,
): Promise<PurchaseResult | null> {
  const purchases = getSharedInstance();
  if (!purchases) return null;

  try {
    const result = await purchases.presentPaywall({
      htmlTarget,
      ...(offering ? { offering } : {}),
    });
    return result;
  } catch (err: any) {
    if (err?.userCancelled) return null;
    throw err;
  }
}

/**
 * Get the current customer info (entitlements, subscriptions, etc.).
 */
export async function getWebCustomerInfo(): Promise<CustomerInfo | null> {
  const purchases = getSharedInstance();
  if (!purchases) return null;

  try {
    return await purchases.getCustomerInfo();
  } catch (err) {
    console.error('Failed to get web customer info:', err);
    return null;
  }
}

/**
 * Check if the user has the Pro entitlement active.
 */
export function hasWebProEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return RC_ENTITLEMENT in info.entitlements.active;
}

/**
 * Listen for real-time customer info updates (e.g. after purchase completes).
 * Returns a cleanup function.
 */
export function onCustomerInfoUpdated(callback: (info: CustomerInfo) => void): () => void {
  const handler = ((event: CustomEvent<CustomerInfo>) => {
    callback(event.detail);
  }) as EventListener;

  window.addEventListener('onCustomerInfoUpdated', handler);
  return () => window.removeEventListener('onCustomerInfoUpdated', handler);
}
