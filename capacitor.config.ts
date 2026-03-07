import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.getswitchdone.boards',
  appName: 'GSD Boards',
  webDir: 'out',
  server: {
    url: 'https://getswitchdone.netlify.app',
    cleartext: false,
    allowNavigation: ['*.supabase.co'],
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#0f1117',
    preferredContentMode: 'mobile',
  },
};

export default config;
