import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';

import QuickActionHandler from '@/components/QuickActionHandler';
import BiometricLockScreen from '@/components/BiometricLockScreen';

export const metadata: Metadata = {
  title: 'GSD Boards',
  description: 'Kanban project boards — Get Stuff Done',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GSD Boards',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f1117',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* PWA: Apple touch icons */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />

        {/* PWA: Apple splash screens */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GSD Boards" />

        {/* PWA: Microsoft tile */}
        <meta name="msapplication-TileColor" content="#0f1117" />

        {/* Force dark color scheme */}
        <meta name="color-scheme" content="dark" />
      </head>
      <body style={{ margin: 0, backgroundColor: '#0f1117' }}>
        <style>{`
          /* PWA safe-area & scroll handling */
          html, body {
            overscroll-behavior-y: none;
            -webkit-overflow-scrolling: touch;
            overflow-x: hidden;
          }
          /* Safe-area padding for iPhone notch / Dynamic Island */
          body {
            padding: 0;
            padding-top: env(safe-area-inset-top) !important;
            padding-bottom: env(safe-area-inset-bottom) !important;
            padding-left: env(safe-area-inset-left) !important;
            padding-right: env(safe-area-inset-right) !important;
          }
          /* Prevent text-size adjust on orientation change */
          html {
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
          }
          /* Disable pull-to-refresh in standalone mode */
          @media all and (display-mode: standalone) {
            body { overscroll-behavior-y: contain; }
          }
          /* Disable tap highlight on iOS */
          * { -webkit-tap-highlight-color: transparent; }
          /* Smooth momentum scrolling for overflow containers */
          [data-scroll] {
            -webkit-overflow-scrolling: touch;
            overflow-y: auto;
          }
          /* Selection color */
          ::selection {
            background: rgba(129, 140, 248, 0.3);
          }
        `}</style>
        <AuthProvider>
          <QuickActionHandler />
          <BiometricLockScreen />
          {children}
        </AuthProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

function ServiceWorkerRegistration() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator && !window.Capacitor) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        `,
      }}
    />
  );
}
