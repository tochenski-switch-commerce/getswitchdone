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

// ── Biometric Login (Keychain) ──

const CREDENTIAL_SERVER = 'com.getswitchdone.boards';

/** Get the biometry type (FACE_ID, TOUCH_ID, OPTIC_ID, none) */
export async function getBiometryType(): Promise<string> {
  const plugin = getPlugin();
  if (!plugin) return 'none';
  try {
    const result = await plugin.isAvailable();
    return result?.biometryType ?? 'none';
  } catch {
    return 'none';
  }
}

/** Human-readable label for biometry type */
export function biometryLabel(type: string): string {
  switch (type) {
    case 'FACE_ID': return 'Face ID';
    case 'TOUCH_ID': return 'Touch ID';
    case 'OPTIC_ID': return 'Optic ID';
    default: return 'Biometrics';
  }
}

/** Store login credentials in the Keychain, protected by biometric */
export async function storeLoginCredentials(email: string, password: string): Promise<boolean> {
  const plugin = getPlugin();
  if (!plugin) return false;
  try {
    await plugin.setCredentials({ server: CREDENTIAL_SERVER, username: email, password });
    return true;
  } catch {
    return false;
  }
}

/** Check if stored login credentials exist (without prompting biometric) */
export async function hasLoginCredentials(): Promise<boolean> {
  const plugin = getPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.hasCredentials({ server: CREDENTIAL_SERVER });
    return result?.hasCredentials === true;
  } catch {
    return false;
  }
}

/** Retrieve stored credentials (triggers biometric prompt) */
export async function getLoginCredentials(): Promise<{ username: string; password: string } | null> {
  const plugin = getPlugin();
  if (!plugin) return null;
  const result = await plugin.getCredentials({
    server: CREDENTIAL_SERVER,
    reason: 'Sign in to GSD Boards',
  });
  if (result?.username && result?.password) {
    return { username: result.username, password: result.password };
  }
  return null;
}

/** Delete stored login credentials */
export async function deleteLoginCredentials(): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.deleteCredentials({ server: CREDENTIAL_SERVER });
  } catch {
    // ignore
  }
}
