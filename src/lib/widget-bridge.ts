/**
 * Bridge to the native WidgetBridge Capacitor plugin.
 * Shares the Supabase auth session with the iOS widget via App Group storage.
 */

function isNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

function getPlugin(): any {
  return (window as any).Capacitor?.Plugins?.WidgetBridge;
}

/** Wait for the plugin to become available (handles registration timing). */
async function waitForPlugin(maxAttempts = 10): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const p = getPlugin();
    if (p) return p;
    await new Promise((r) => setTimeout(r, 300));
  }
  console.warn('[WidgetBridge] plugin not available after retries');
  return null;
}

export async function syncSessionToWidget(accessToken: string, refreshToken: string | undefined, userId: string) {
  if (!isNative()) return;
  const plugin = await waitForPlugin();
  if (!plugin) return;
  try {
    await plugin.setSession({ accessToken, refreshToken, userId });
    console.log('[WidgetBridge] session synced');
  } catch (err) {
    console.error('[WidgetBridge] setSession failed:', err);
  }
}

export async function clearWidgetSession() {
  if (!isNative()) return;
  const plugin = await waitForPlugin(3);
  if (!plugin) return;
  try {
    await plugin.clearSession();
  } catch (err) {
    console.error('[WidgetBridge] clearSession failed:', err);
  }
}

export async function reloadWidgets() {
  if (!isNative()) return;
  const plugin = await waitForPlugin(3);
  if (!plugin) return;
  try {
    await plugin.reloadWidgets();
  } catch (err) {
    console.error('[WidgetBridge] reloadWidgets failed:', err);
  }
}
