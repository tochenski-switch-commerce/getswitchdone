export type PlanTier = 'free' | 'pro';

export const PLANS = {
  free: {
    label: 'Free',
    maxBoards: Infinity,
    maxActiveCards: Infinity,
    teamsEnabled: true,
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
