function isNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

function getPlugin(): any {
  return (window as any).Capacitor?.Plugins?.BadgeManager;
}

export async function setBadgeCount(count: number) {
  if (!isNative()) return;
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.setBadgeCount({ count: Math.max(0, count) });
  } catch (err) {
    console.error('Failed to set badge count:', err);
  }
}

export async function clearBadge() {
  if (!isNative()) return;
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.clearBadge();
  } catch (err) {
    console.error('Failed to clear badge:', err);
  }
}
