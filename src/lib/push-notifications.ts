import { supabase } from './supabase';

function isNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

function getPlatform(): string {
  return (window as any).Capacitor?.getPlatform?.() || 'web';
}

function getPlugin(): any {
  return (window as any).Capacitor?.Plugins?.PushNotifications;
}

let registered = false;
let currentToken: string | null = null;
const listeners: string[] = [];

export async function registerPushNotifications(userId: string) {
  console.log('[PUSH] registerPushNotifications called, userId:', userId);
  console.log('[PUSH] isNative:', isNative(), 'registered:', registered);
  if (!isNative() || registered) return;

  const push = getPlugin();
  console.log('[PUSH] plugin:', push ? 'found' : 'NOT FOUND');
  if (!push) return;

  try {
    let permStatus = await push.checkPermissions();
    console.log('[PUSH] permStatus:', JSON.stringify(permStatus));
    if (permStatus.receive === 'prompt') {
      permStatus = await push.requestPermissions();
      console.log('[PUSH] after request:', JSON.stringify(permStatus));
    }
    if (permStatus.receive !== 'granted') { console.log('[PUSH] not granted, bailing'); return; }

    console.log('[PUSH] registering listeners...');
    // Registration success
    const regListener = await push.addListener('registration', async (token: any) => {
      console.log('[PUSH] got token:', token.value?.substring(0, 20) + '...');
      currentToken = token.value;
      await supabase.from('device_tokens').upsert(
        {
          user_id: userId,
          token: token.value,
          platform: getPlatform(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      );
    });

    // Registration error
    const errListener = await push.addListener('registrationError', (error: any) => {
      console.error('Push registration failed:', error);
    });

    // Foreground notification
    const fgListener = await push.addListener('pushNotificationReceived', () => {});

    // User tapped a push notification
    const tapListener = await push.addListener('pushNotificationActionPerformed', (action: any) => {
      const data = action.notification.data;
      if (data?.board_id && data?.card_id) {
        window.location.href = `/boards/${encodeURIComponent(data.board_id)}?card=${encodeURIComponent(data.card_id)}`;
      } else if (data?.board_id) {
        window.location.href = `/boards/${encodeURIComponent(data.board_id)}`;
      } else {
        window.location.href = '/boards';
      }
    });

    await push.register();
    registered = true;
  } catch (err) {
    console.error('Push notification setup failed:', err);
  }
}

export async function unregisterPushNotifications(userId: string) {
  if (!isNative()) return;

  const push = getPlugin();
  if (!push) return;

  try {
    if (currentToken) {
      await supabase
        .from('device_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', currentToken);
    }
    await push.removeAllListeners();
    registered = false;
    currentToken = null;
  } catch (err) {
    console.error('Push unregister failed:', err);
  }
}
