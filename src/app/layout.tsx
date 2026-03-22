import type { Metadata, Viewport } from 'next';
import WebNotificationManager from '@/components/WebNotificationManager';

export const metadata: Metadata = {
  title: 'Lumio',
  description: 'Kanban project boards — Lumio',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lumio',
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
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Lumio" />
        <meta name="msapplication-TileColor" content="#0f1117" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body style={{ margin: 0, backgroundColor: '#0f1117', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}>
        <style>{`
          html, body {
            overscroll-behavior-y: none;
            -webkit-overflow-scrolling: touch;
          }
          body {
            overflow-x: hidden;
            padding: 0;
            padding-top: env(safe-area-inset-top) !important;
            padding-bottom: env(safe-area-inset-bottom) !important;
            padding-left: env(safe-area-inset-left) !important;
            padding-right: env(safe-area-inset-right) !important;
          }
          html {
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
          }
          @media all and (display-mode: standalone) {
            body { overscroll-behavior-y: contain; }
          }
          * { -webkit-tap-highlight-color: transparent; }
          [data-scroll] {
            -webkit-overflow-scrolling: touch;
            overflow-y: auto;
          }
          ::selection {
            background: rgba(129, 140, 248, 0.3);
          }
        `}</style>
        {children}
        <WebNotificationManager />
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
            function registerSW() { navigator.serviceWorker.register('/sw.js'); }
            if (document.readyState === 'complete') {
              registerSW();
            } else {
              window.addEventListener('load', registerSW);
            }
          }
        `,
      }}
    />
  );
}
