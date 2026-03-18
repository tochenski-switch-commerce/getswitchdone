/**
 * RevenueCat iOS Capacitor bridge.
 * Wraps the native RevenueCatBridge plugin registered in AppDelegate.swift.
 * On web, all methods are no-ops.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

interface Package {
  identifier: string;
  productId: string;
  localizedPrice: string;
  price: number;
  currencyCode: string;
}

interface CustomerInfo {
  entitlements: Record<string, { isActive: boolean; expiresDate: string | null }>;
  activeSubscriptions: string[];
}

interface RevenueCatPlugin {
  configure(options: { apiKey: string }): Promise<void>;
  login(options: { userId: string }): Promise<{ customerInfo: CustomerInfo }>;
  logout(): Promise<void>;
  getOfferings(): Promise<{ current: { monthly: Package | null; annual: Package | null; availablePackages: Package[] } | null }>;
  purchasePackage(options: { packageId: string }): Promise<{ customerInfo: CustomerInfo }>;
  getCustomerInfo(): Promise<{ customerInfo: CustomerInfo }>;
  restorePurchases(): Promise<{ customerInfo: CustomerInfo }>;
  manageSubscriptions(): Promise<void>;
}

const RevenueCatBridge = registerPlugin<RevenueCatPlugin>('RevenueCatBridge');

export const isNative = () => Capacitor.isNativePlatform();

export async function configureRevenueCat() {
  if (!isNative()) return;
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_IOS;
  if (!apiKey) return;
  await RevenueCatBridge.configure({ apiKey });
}

export async function loginRevenueCat(userId: string): Promise<CustomerInfo | null> {
  if (!isNative()) return null;
  const { customerInfo } = await RevenueCatBridge.login({ userId });
  return customerInfo;
}

export async function logoutRevenueCat(): Promise<void> {
  if (!isNative()) return;
  await RevenueCatBridge.logout();
}

export async function getOfferings() {
  if (!isNative()) return null;
  const { current } = await RevenueCatBridge.getOfferings();
  return current;
}

export async function purchasePackage(packageId: string): Promise<CustomerInfo | null> {
  if (!isNative()) return null;
  const { customerInfo } = await RevenueCatBridge.purchasePackage({ packageId });
  return customerInfo;
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isNative()) return null;
  const { customerInfo } = await RevenueCatBridge.getCustomerInfo();
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!isNative()) return null;
  const { customerInfo } = await RevenueCatBridge.restorePurchases();
  return customerInfo;
}

export async function manageSubscription(): Promise<void> {
  if (!isNative()) return;
  await RevenueCatBridge.manageSubscriptions();
}

/** Check if the 'pro' entitlement is active from CustomerInfo */
export function hasProEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return info.entitlements?.pro?.isActive === true;
}
