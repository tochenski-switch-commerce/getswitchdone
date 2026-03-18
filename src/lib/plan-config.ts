export type PlanTier = 'free' | 'pro';

export const PLANS = {
  free: {
    label: 'Free',
    maxBoards: 1,
    maxActiveCards: 10,
    teamsEnabled: false,
    aiEnabled: false,
  },
  pro: {
    label: 'Pro',
    maxBoards: Infinity,
    maxActiveCards: Infinity,
    teamsEnabled: true,
    aiEnabled: true,
  },
} as const;

export type PlanLimits = (typeof PLANS)[PlanTier];

/** RevenueCat entitlement identifier */
export const RC_ENTITLEMENT = 'Lumio Boards Pro';

/** RevenueCat product identifiers */
export const RC_PRODUCTS = {
  monthly: 'monthly',
  yearly: 'yearly',
  lifetime: 'lifetime',
} as const;

/** RevenueCat Web Billing API key */
export const RC_WEB_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_WEB ?? '';
