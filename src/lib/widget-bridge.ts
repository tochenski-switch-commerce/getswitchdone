/**
 * Bridge to the native WidgetBridge Capacitor plugin.
 * Shares the Supabase auth session with the iOS widget via App Group storage.
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: {
        WidgetBridge?: {
          setSession: (opts: { accessToken: string; refreshToken?: string; userId: string }) => Promise<{ success: boolean }>;
          clearSession: () => Promise<{ success: boolean }>;
          reloadWidgets: () => Promise<{ success: boolean }>;
        };
      };
    };
  }
}

function isNative(): boolean {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}

export async function syncSessionToWidget(accessToken: string, refreshToken: string | undefined, userId: string) {
  if (!isNative()) return;
  try {
    await window.Capacitor!.Plugins!.WidgetBridge!.setSession({
      accessToken,
      refreshToken,
      userId,
    });
  } catch {
    // Widget bridge not available — ignore
  }
}

export async function clearWidgetSession() {
  if (!isNative()) return;
  try {
    await window.Capacitor!.Plugins!.WidgetBridge!.clearSession();
  } catch {
    // Widget bridge not available — ignore
  }
}

export async function reloadWidgets() {
  if (!isNative()) return;
  try {
    await window.Capacitor!.Plugins!.WidgetBridge!.reloadWidgets();
  } catch {
    // Widget bridge not available — ignore
  }
}
