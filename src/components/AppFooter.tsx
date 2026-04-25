'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AppFooter() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setIsNative(!!(window as any).Capacitor?.isNativePlatform?.());
  }, []);

  if (isNative || !user || pathname.startsWith('/f/') || pathname.startsWith('/join/')) return null;

  return (
    <>
      <style>{`
        .kb-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: #0f1117;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
        }
        .kb-footer-left {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #4b5563;
          font-size: 12px;
        }
        .kb-footer-links {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .kb-footer-link {
          color: #4b5563;
          font-size: 12px;
          text-decoration: none;
          transition: color 0.15s;
        }
        .kb-footer-link:hover { color: #9ca3af; }
        @media (max-width: 600px) {
          .kb-footer { display: none; }
        }
      `}</style>
      <footer className="kb-footer">
        <div className="kb-footer-left">
          {/* Flame mark */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 55 85"
            style={{ height: 13, width: 'auto', flexShrink: 0 }}
            aria-hidden="true"
          >
            <path
              fill="#fa420f"
              d="M27.5,85 C19.7,85 13.1,82.3 7.7,76.8 C2.3,71.3 0,64.8 0,57.1 C-0.06,42.5 6.9,32.8 12.2,28.2 C9.3,44.2 25.8,44.6 21.2,31.6 C14.7,10.2 27.5,0 27.5,0 C27.5,0 28.7,13.3 47.5,37.4 C52,43.1 55,49.2 55,57.1 C55,64.8 52.5,71.3 47.5,76.8 C42.5,82.3 35.9,85 27.5,85 Z"
            />
          </svg>
          <span>© {new Date().getFullYear()} Lumio</span>
        </div>
        <div className="kb-footer-links">
          <a
            className="kb-footer-link"
            href="/f/bug-report-kcn9gg"
            target="_blank"
            rel="noopener noreferrer"
          >
            Report a bug
          </a>
          <a className="kb-footer-link" href="/privacy">
            Privacy
          </a>
          <a className="kb-footer-link" href="/terms">
            Terms
          </a>
        </div>
      </footer>
    </>
  );
}
