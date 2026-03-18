import { useCallback } from 'react';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';

/**
 * Convenience hook for feature gating throughout the app.
 * Wraps SubscriptionContext with helper methods for checking limits.
 */
export function useSubscription() {
  const ctx = useSubscriptionContext();

  const canCreateBoard = useCallback((currentBoardCount: number) => {
    if (ctx.isProUser) return true;
    return currentBoardCount < ctx.limits.maxBoards;
  }, [ctx.isProUser, ctx.limits.maxBoards]);

  const canCreateCard = useCallback((currentActiveCardCount: number) => {
    if (ctx.isProUser) return true;
    return currentActiveCardCount < ctx.limits.maxActiveCards;
  }, [ctx.isProUser, ctx.limits.maxActiveCards]);

  const canUseTeams = ctx.limits.teamsEnabled;
  const canUseAI = ctx.limits.aiEnabled;

  return {
    ...ctx,
    canCreateBoard,
    canCreateCard,
    canUseTeams,
    canUseAI,
  };
}
