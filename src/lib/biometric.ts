/**
 * Biometric authentication (Face ID / Touch ID) via Capacitor native bridge.
 * Uses window.Capacitor directly since the app loads from a remote URL.
 */

function isNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

function getPlugin() {
  if (!isNative()) return null;
  const cap = (window as any).Capacitor;
  return cap?.Plugins?.NativeBiometric ?? null;
}

const LOCK_KEY = 'gsd_biometric_lock';

/** Check if the device supports biometric auth */
export async function isBiometricAvailable(): Promise<boolean> {
  const plugin = getPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.isAvailable();
    return result?.isAvailable === true;
  } catch {
    return false;
  }
}

/** Prompt user for biometric verification (Face ID / Touch ID) */
export async function verifyBiometric(): Promise<boolean> {
  const plugin = getPlugin();
  if (!plugin) return true; // non-native → always pass
  try {
    await plugin.verifyIdentity({
      reason: 'Unlock GSD Boards',
      title: 'Authentication Required',
      subtitle: 'Verify your identity to continue',
      useFallback: true,
      fallbackTitle: 'Use Passcode',
      maxAttempts: 3,
    });
    return true;
  } catch {
    return false;
  }
}

/** Check if user has enabled biometric lock */
export function isBiometricLockEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(LOCK_KEY) === 'true';
}

/** Enable/disable biometric lock */
export function setBiometricLockEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  if (enabled) {
    localStorage.setItem(LOCK_KEY, 'true');
  } else {
    localStorage.removeItem(LOCK_KEY);
  }
}
