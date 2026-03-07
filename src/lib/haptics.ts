/**
 * Haptic feedback via Capacitor's native bridge.
 * Uses window.Capacitor directly since the app loads from a remote URL.
 */

function isNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

function callPlugin(plugin: string, method: string, options?: any) {
  if (!isNative()) return;
  try {
    const cap = (window as any).Capacitor;
    // Capacitor injects Plugins on the bridge
    const p = cap?.Plugins?.[plugin];
    if (p && typeof p[method] === 'function') {
      p[method](options);
    }
  } catch {
    // silently ignore
  }
}

/** Light tap — drag start, toggle, select */
export function hapticLight() {
  callPlugin('Haptics', 'impact', { style: 'LIGHT' });
}

/** Medium tap — drop card into column, add card */
export function hapticMedium() {
  callPlugin('Haptics', 'impact', { style: 'MEDIUM' });
}

/** Heavy tap — delete, destructive action */
export function hapticHeavy() {
  callPlugin('Haptics', 'impact', { style: 'HEAVY' });
}

/** Success — checklist complete, mark all read */
export function hapticSuccess() {
  callPlugin('Haptics', 'notification', { type: 'SUCCESS' });
}

/** Warning — overdue, error */
export function hapticWarning() {
  callPlugin('Haptics', 'notification', { type: 'WARNING' });
}

/** Selection tick — scrolling through items, drag over column */
export function hapticSelection() {
  callPlugin('Haptics', 'selectionStart', {});
  callPlugin('Haptics', 'selectionChanged', {});
  callPlugin('Haptics', 'selectionEnd', {});
}
