import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Update Log — Lumio',
  description: 'A running log of changes, fixes, and new features in Lumio.',
};

type ChangeType = 'feature' | 'improvement' | 'fix';

interface ChangeEntry {
  date: string;
  description: string;
  page: string | null;
  type: ChangeType;
}

const TYPE_LABEL: Record<ChangeType, string> = {
  feature: 'New Feature',
  improvement: 'Improvement',
  fix: 'Bug Fix',
};

const TYPE_COLORS: Record<ChangeType, { bg: string; text: string; border: string }> = {
  feature: { bg: 'rgba(99,102,241,0.15)', text: '#a5b4fc', border: 'rgba(99,102,241,0.35)' },
  improvement: { bg: 'rgba(168,85,247,0.15)', text: '#d8b4fe', border: 'rgba(168,85,247,0.35)' },
  fix: { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d', border: 'rgba(245,158,11,0.35)' },
};

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function Badge({ type }: { type: ChangeType }) {
  const { bg, text, border } = TYPE_COLORS[type];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: bg,
      color: text,
      border: `1px solid ${border}`,
    }}>
      {TYPE_LABEL[type]}
    </span>
  );
}

export default function UpdateLogPage() {
  const filePath = path.join(process.cwd(), 'public', 'changelog.json');
  const entries: ChangeEntry[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  return (
    <div style={{
      background: '#0f1117',
      color: '#f1f5f9',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
      minHeight: '100vh',
    }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(15,17,23,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 24px',
      }}>
        <div style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          height: 56,
          gap: 8,
        }}>
          <Link href="/boards" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'rgba(255,255,255,0.5)',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
            transition: 'color 0.15s',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to boards
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '48px 24px 40px',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{
            margin: '0 0 10px',
            fontSize: 12,
            fontWeight: 600,
            color: '#FF6B35',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
          }}>
            Changelog
          </p>
          <h1 style={{
            margin: '0 0 12px',
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}>
            Update Log
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
            What&apos;s new, fixed, and improved in Lumio — most recent first.
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ padding: '8px 24px 96px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 32 }}>
          {entries.map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: 24, paddingBottom: 32 }}>
              {/* Timeline spine */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 16 }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: TYPE_COLORS[entry.type].text,
                  border: `2px solid ${TYPE_COLORS[entry.type].border}`,
                  marginTop: 6,
                  flexShrink: 0,
                }} />
                {i < entries.length - 1 && (
                  <div style={{
                    width: 1,
                    flex: 1,
                    background: 'rgba(255,255,255,0.07)',
                    marginTop: 6,
                  }} />
                )}
              </div>

              {/* Card */}
              <div style={{
                flex: 1,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: i < entries.length - 1 ? 0 : 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <time style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                    {formatDate(entry.date)}
                  </time>
                  <Badge type={entry.type} />
                </div>
                <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65 }}>
                  {entry.description}
                </p>
                {entry.page && (
                  <Link href={entry.page} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 12,
                    fontSize: 13,
                    color: '#818cf8',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}>
                    View page
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
