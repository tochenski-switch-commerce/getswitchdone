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
