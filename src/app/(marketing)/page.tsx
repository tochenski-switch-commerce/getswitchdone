import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lumio — Work that actually gets done',
  description: 'Lumio is the team board that keeps everyone aligned — with AI that surfaces what matters, and mobile access that goes wherever you do.',
  openGraph: {
    title: 'Lumio — Work that actually gets done',
    description: 'Kanban boards with AI triage and native mobile. Built for teams who ship.',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lumio — Work that actually gets done',
    description: 'Kanban boards with AI triage and native mobile. Built for teams who ship.',
  },
};

// ── Lumio wordmark SVG ────────────────────────────────────────
function LumioWordmark({ height = 32, color = 'currentColor' }: { height?: number; color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 0 851 290" aria-label="Lumio" style={{ height, width: 'auto', color }}>
      <path fillRule="evenodd" fill="currentColor" transform="translate(0, -3.891)" d="M836.649,243.604 C828.405,257.165 817.226,267.951 803.100,275.964 C788.974,283.982 772.961,287.989 755.072,287.989 C737.177,287.989 721.169,283.982 707.043,275.964 C692.918,267.951 681.733,257.104 673.494,243.427 C665.251,229.756 661.134,214.427 661.134,197.451 C661.134,180.713 665.195,165.622 673.318,152.183 C681.440,138.744 692.564,128.078 706.690,120.176 C720.816,112.280 736.940,108.329 755.072,108.329 C772.729,108.329 788.676,112.219 802.923,119.100 C817.165,127.780 828.405,138.451 836.649,152.006 C844.887,165.567 849.009,180.713 849.009,197.451 C849.009,214.665 844.887,230.049 836.649,243.604 ZM788.621,177.116 C785.321,171.104 780.791,166.390 775.024,162.969 C769.253,159.554 762.604,157.841 755.072,157.841 C747.534,157.841 740.824,159.554 734.942,162.969 C729.055,166.390 724.464,171.164 721.169,177.293 C717.870,183.426 716.225,190.262 716.225,197.805 C716.225,205.823 717.870,212.957 721.169,219.201 C724.464,225.451 729.055,230.226 734.942,233.525 C740.824,236.829 747.534,238.476 755.072,238.476 C762.604,238.476 769.313,236.829 775.201,233.525 C781.083,230.226 785.619,225.451 788.797,219.201 C791.976,212.957 793.565,205.823 793.565,197.805 C793.565,190.024 791.915,183.128 788.621,177.116 Z" />
      <path fill="currentColor" d="M607.665,85.002 C599.884,85.002 593.331,82.269 587.998,76.798 C582.665,71.331 580.028,64.768 579.998,57.107 C579.941,42.541 586.944,32.765 592.177,28.186 C589.274,44.173 605.779,44.594 601.191,31.580 C594.742,10.187 607.500,0.000 607.500,0.000 C607.500,0.000 608.726,13.316 627.498,37.416 C631.946,43.126 634.998,49.231 634.998,57.107 C634.998,64.768 632.498,71.331 627.498,76.798 C622.498,82.269 615.883,85.002 607.665,85.002 ZM491.959,189.321 C491.959,183.425 490.900,178.297 488.781,173.937 C486.662,169.571 483.605,166.212 479.599,163.858 C475.598,161.498 470.892,160.321 465.473,160.321 C457.472,160.321 451.170,162.913 446.579,168.101 C441.989,173.285 439.693,180.358 439.693,189.321 L439.693,287.993 L439.283,287.993 L385.308,287.993 L384.898,287.993 L384.898,189.321 C384.898,183.425 383.839,178.297 381.720,173.937 C379.601,169.571 376.544,166.212 372.538,163.858 C368.538,161.498 363.831,160.321 358.412,160.321 C350.411,160.321 344.110,162.913 339.519,168.101 C334.928,173.285 332.633,180.358 332.633,189.321 L332.633,287.993 L278.248,287.993 L278.248,188.614 C278.248,173.522 281.603,160.260 288.313,148.827 C295.022,137.388 304.381,128.431 316.388,121.949 C328.395,115.467 342.405,112.223 358.412,112.223 C373.951,112.223 387.900,115.528 400.260,122.126 C404.440,124.356 408.295,126.871 411.842,129.655 C415.390,126.787 419.254,124.213 423.448,121.949 C435.455,115.467 449.465,112.223 465.473,112.223 C481.011,112.223 494.961,115.528 507.321,122.126 C519.681,128.724 529.277,137.742 536.103,149.181 C542.934,160.614 546.344,173.760 546.344,188.614 L546.344,287.993 L491.959,287.993 L491.959,189.321 ZM210.814,278.263 C198.807,284.745 184.797,287.989 168.789,287.989 C153.251,287.989 139.302,284.684 126.941,278.086 C114.581,271.488 104.986,262.470 98.160,251.031 C91.329,239.598 87.918,226.451 87.918,211.598 L87.918,112.219 L142.303,112.219 L142.303,210.890 C142.303,216.787 143.363,221.915 145.482,226.275 C147.601,230.640 150.657,233.100 154.664,236.354 C158.664,238.714 163.371,239.891 168.789,239.891 C176.790,239.891 183.092,237.299 187.683,232.110 C192.274,226.927 194.569,219.854 194.569,210.890 L194.569,112.219 L248.954,112.219 L248.954,211.598 C248.954,226.689 245.599,239.951 238.889,251.385 C232.179,262.823 222.821,271.781 210.814,278.263 ZM-0.015,27.340 L54.369,27.340 L54.369,284.098 L-0.015,284.098 L-0.015,27.340 ZM634.648,284.098 L580.263,284.098 L580.263,112.219 L634.648,112.219 L634.648,284.098 Z" />
    </svg>
  );
}

function FlameIcon({ size = 48, color = '#fa420f' }: { size?: number; color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="578 -2 60 92" aria-hidden="true" style={{ height: size, width: 'auto', flexShrink: 0 }}>
      <path fill={color} d="M607.665,85.002 C599.884,85.002 593.331,82.269 587.998,76.798 C582.665,71.331 580.028,64.768 579.998,57.107 C579.941,42.541 586.944,32.765 592.177,28.186 C589.274,44.173 605.779,44.594 601.191,31.580 C594.742,10.187 607.500,0.000 607.500,0.000 C607.500,0.000 608.726,13.316 627.498,37.416 C631.946,43.126 634.998,49.231 634.998,57.107 C634.998,64.768 632.498,71.331 627.498,76.798 C622.498,82.269 615.883,85.002 607.665,85.002 Z" />
    </svg>
  );
}

// ── Check icon ────────────────────────────────────────────────
function Check({ color = '#fa420f' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="8" cy="8" r="8" fill={color} fillOpacity="0.15" />
      <path d="M4.5 8l2.5 2.5 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function X() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="8" cy="8" r="8" fill="rgba(255,255,255,0.05)" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Data ─────────────────────────────────────────────────────
const features = [
  {
    title: 'Kanban Boards',
    description: 'Flexible columns, drag-and-drop cards, and custom labels. See your entire workflow at a glance.',
  },
  {
    title: 'Team Collaboration',
    description: 'Invite teammates, assign cards, leave comments, and @mention anyone in real time.',
  },
  {
    title: 'Mobile App',
    description: 'Native iOS app with full board access, push notifications, and offline support.',
  },
];

const steps = [
  { number: '01', title: 'Create a board', description: 'Pick a template or start from scratch. Invite your team in seconds.' },
  { number: '02', title: 'Add cards', description: 'Break work into cards, assign owners, set due dates, and add checklists.' },
  { number: '03', title: 'Get things done', description: 'Move cards through columns, track progress, and ship with confidence.' },
];

const testimonials = [
  {
    quote: "We replaced three separate tools with Lumio. Our team actually knows what everyone's working on now.",
    name: 'Sarah Chen',
    role: 'Head of Product, Fieldline',
    initials: 'SC',
    color: '#6366f1',
  },
  {
    quote: "The board updates in real time across our whole team. No more 'wait, which version is current?' moments.",
    name: 'Marcus Reid',
    role: 'Engineering Lead, Draftbit',
    initials: 'MR',
    color: '#0ea5e9',
  },
  {
    quote: "Finally a board app that works on mobile. I can triage my team's cards from anywhere.",
    name: 'Priya Nair',
    role: 'Founder, Bloom Studio',
    initials: 'PN',
    color: '#10b981',
  },
];

const faq = [
  {
    q: 'Is Lumio really free?',
    a: 'Yes. The free plan includes up to 3 boards and 5 team members with no time limit. No credit card required to sign up.',
  },
  {
    q: 'Is my data private and secure?',
    a: 'All data is encrypted in transit and at rest. We never sell or share your data. You can export or delete everything at any time.',
  },
  {
    q: 'Does the mobile app work offline?',
    a: 'Yes. The iOS app caches your boards locally so you can view and update cards even without a connection. Changes sync when you reconnect.',
  },
  {
    q: 'Can I migrate from Trello or Notion?',
    a: 'Trello CSV import is supported today. Notion and Linear importers are in beta — reach out and we\'ll get you set up.',
  },
];

const pricingFree = [
  '1 board',
  'Solo use (no teams)',
  'Up to 10 active cards',
  'Mobile app access',
];

const pricingPro = [
  'Unlimited boards',
  'Unlimited team members',
  'Advanced automations',
  'Priority support',
  'Admin controls & audit log',
];

const comparison = [
  { feature: 'Kanban boards',         lumio: true,  trello: true,  notion: true,  linear: true  },
  { feature: 'Native iOS app',        lumio: true,  trello: false, notion: false, linear: true  },
  { feature: 'Real-time collab',      lumio: true,  trello: true,  notion: true,  linear: true  },
  { feature: 'Offline support',       lumio: true,  trello: false, notion: false, linear: false },
  { feature: 'Free team plan',        lumio: true,  trello: true,  notion: false, linear: false },
  { feature: 'Form-to-card capture',  lumio: true,  trello: false, notion: false, linear: false },
];

// ── Board mockup ──────────────────────────────────────────────
const mockColumns = [
  {
    title: 'To Do',
    color: 'rgba(255,255,255,0.35)',
    cards: [
      { title: 'Design system audit', tag: 'Design', tagColor: '#6366f1', avatar: 'SC' },
      { title: 'Write onboarding copy', tag: 'Content', tagColor: '#0ea5e9', avatar: 'MR' },
      { title: 'User research interviews', tag: 'Research', tagColor: '#10b981', avatar: 'PN' },
    ],
  },
  {
    title: 'In Progress',
    color: '#fa420f',
    cards: [
      { title: 'Build auth flow', tag: 'Engineering', tagColor: '#f59e0b', avatar: 'SC', progress: 60 },
      { title: 'API integration', tag: 'Engineering', tagColor: '#f59e0b', avatar: 'MR', progress: 35 },
    ],
  },
  {
    title: 'Done',
    color: '#10b981',
    cards: [
      { title: 'Setup project repo', tag: 'Engineering', tagColor: '#f59e0b', avatar: 'MR' },
      { title: 'Database schema', tag: 'Engineering', tagColor: '#f59e0b', avatar: 'SC' },
    ],
  },
];

function BoardMockup() {
  return (
    <div style={{
      width: '100%',
      maxWidth: 900,
      margin: '0 auto',
      background: '#141414',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
    }}>
      {/* Window chrome */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#1a1a1a',
      }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
          lumio.app/boards/q4-launch
        </div>
      </div>

      {/* Board header */}
      <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🚀</span>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>Q4 Launch</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '3px 10px' }}>+ New Card</span>
      </div>

      {/* Columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        padding: '0 16px 20px',
      }}>
        {mockColumns.map((col) => (
          <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Column header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 8px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {col.title}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{col.cards.length}</span>
            </div>

            {/* Cards */}
            {col.cards.map((card) => (
              <div key={card.title} style={{
                background: '#1e1e1e',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10,
                padding: '12px 12px 10px',
              }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
                  {card.title}
                </p>
                {'progress' in card && (
                  <div style={{ margin: '0 0 10px', height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${card.progress}%`, background: '#fa420f', borderRadius: 99 }} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: card.tagColor,
                    background: `${card.tagColor}20`,
                    borderRadius: 4,
                    padding: '2px 6px',
                    letterSpacing: '0.02em',
                  }}>
                    {card.tag}
                  </span>
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.6)',
                    letterSpacing: '0.02em',
                  }}>
                    {card.avatar}
                  </div>
                </div>
              </div>
            ))}

            {/* Add card ghost */}
            <div style={{
              border: '1px dashed rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 12,
              color: 'rgba(255,255,255,0.2)',
              cursor: 'default',
            }}>
              + Add card
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function Home() {
  const colStyle = (highlight = false): React.CSSProperties => ({
    background: highlight ? '#fa420f' : '#1a1a1a',
    border: `1px solid ${highlight ? '#fa420f' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 16,
    padding: '32px 28px 36px',
    display: 'flex',
    flexDirection: 'column',
  });

  return (
    <div style={{ background: '#0f0f0f', color: '#fff', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.6s ease both; }
        .fade-up-1 { animation-delay: 0.05s; }
        .fade-up-2 { animation-delay: 0.15s; }
        .fade-up-3 { animation-delay: 0.25s; }
        .fade-up-4 { animation-delay: 0.35s; }
        a.nav-signin:hover { color: #fff !important; }
        a.cta-btn:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 0 56px rgba(250,66,15,0.45) !important; }
        a.cta-btn { transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s; }
        a.cta-white:hover { background: #f0f0f0 !important; }
        a.cta-white { transition: background 0.15s; }
        .feature-card:hover { border-color: rgba(250,66,15,0.3) !important; background: #1e1e1e !important; }
        .feature-card { transition: border-color 0.2s, background 0.2s; }
        .mobile-cta { display: none; }
        @media (max-width: 640px) {
          .mobile-cta { display: flex !important; }
          .desktop-comparison { display: none !important; }
        }
        @media (max-width: 768px) {
          .steps-grid { flex-direction: column !important; }
          .steps-grid > div { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.07); padding: 0 0 32px !important; margin-bottom: 32px; }
          .steps-grid > div:last-child { border-bottom: none !important; margin-bottom: 0; padding-bottom: 0 !important; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(15,15,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <LumioWordmark height={26} color="#ffffff" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Link href="#pricing" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Pricing</Link>
            <Link href="/auth" className="nav-signin" style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>Sign In</Link>
            <Link href="/auth?tab=signup" className="cta-btn" style={{ background: '#fa420f', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700, padding: '8px 18px', borderRadius: 8, boxShadow: '0 0 20px rgba(250,66,15,0.2)' }}>
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '88px 24px 80px', background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(250,66,15,0.13) 0%, transparent 70%)' }}>
        {/* Social proof pill */}
        <div className="fade-up fade-up-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 99, padding: '6px 14px 6px 8px', marginBottom: 32 }}>
          <div style={{ display: 'flex' }}>
            {['#6366f1','#0ea5e9','#10b981'].map((c, i) => (
              <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: '2px solid #0f0f0f', marginLeft: i === 0 ? 0 : -6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                {['SC','MR','PN'][i]}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Trusted by <strong style={{ color: '#fff' }}>500+ teams</strong></span>
        </div>

        <FlameIcon size={64} color="#fa420f" />
        <h1 className="fade-up fade-up-2" style={{ marginTop: 24, marginBottom: 0, fontSize: 'clamp(40px, 6vw, 76px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, maxWidth: 820 }}>
          See the work.{' '}
          <span style={{ color: '#fa420f' }}>Do the work.</span>
        </h1>
        <p className="fade-up fade-up-3" style={{ marginTop: 24, marginBottom: 0, fontSize: 'clamp(17px, 2.2vw, 21px)', color: 'rgba(255,255,255,0.5)', maxWidth: 560, lineHeight: 1.65, fontWeight: 400 }}>
          Lumio keeps your team aligned with kanban boards, AI that surfaces what matters, and a native mobile app for wherever work happens.
        </p>
        <div className="fade-up fade-up-4" style={{ marginTop: 44, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/auth?tab=signup" className="cta-btn" style={{ display: 'inline-block', padding: '16px 40px', background: '#fa420f', color: '#fff', borderRadius: 10, fontSize: 17, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.01em', boxShadow: '0 0 40px rgba(250,66,15,0.35)' }}>
            Get Started Free
          </Link>
        </div>
        <p style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.02em' }}>No credit card required · Free forever plan</p>
      </section>

      {/* ── Product mockup ── */}
      <section style={{ padding: '0 24px 96px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <BoardMockup />
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '80px 24px', background: '#111111' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 12, marginTop: 0 }}>
            Everything your team needs
          </h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 17, marginBottom: 56, marginTop: 0 }}>
            One tool. No duct tape required.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {features.map((f) => (
              <div key={f.title} className="feature-card" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '28px 28px 32px' }}>
                <FlameIcon size={26} color="#fa420f" />
                <h3 style={{ marginTop: 18, marginBottom: 10, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: '96px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 700, letterSpacing: '-0.025em', marginTop: 0, marginBottom: 56 }}>
            Teams love it
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {testimonials.map((t) => (
              <div key={t.name} style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '28px 28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Stars */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="#fa420f" aria-hidden="true">
                      <path d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.44L7 8.885 3.91 10.51l.59-3.44L2 4.635l3.455-.505L7 1z"/>
                    </svg>
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: 16, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, fontStyle: 'italic', flex: 1 }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {t.initials}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{t.name}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '80px 24px', background: '#111111' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 700, letterSpacing: '-0.025em', marginTop: 0, marginBottom: 64 }}>
            Up and running in minutes
          </h2>
          <div className="steps-grid" style={{ display: 'flex', gap: 0 }}>
            {steps.map((step, i) => (
              <div key={step.number} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderRight: i < steps.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none', paddingRight: i < steps.length - 1 ? 48 : 0, paddingLeft: i > 0 ? 48 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fa420f', letterSpacing: '0.08em' }}>{step.number}</span>
                <h3 style={{ marginTop: 14, marginBottom: 12, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison ── */}
      <section style={{ padding: '96px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 700, letterSpacing: '-0.025em', marginTop: 0, marginBottom: 12 }}>
            How we stack up
          </h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 17, marginBottom: 48, marginTop: 0 }}>
            Lumio vs the tools you might already know.
          </p>
          <div className="desktop-comparison" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>Feature</th>
                  {['Lumio', 'Trello', 'Notion', 'Linear'].map((tool) => (
                    <th key={tool} style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid rgba(255,255,255,0.07)', color: tool === 'Lumio' ? '#fa420f' : 'rgba(255,255,255,0.5)' }}>
                      {tool}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.feature} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{row.feature}</td>
                    {[row.lumio, row.trello, row.notion, row.linear].map((val, j) => (
                      <td key={j} style={{ textAlign: 'center', padding: '14px 16px' }}>
                        {val ? <Check color={j === 0 ? '#fa420f' : '#10b981'} /> : <X />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '80px 24px', background: '#111111' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 700, letterSpacing: '-0.025em', marginTop: 0, marginBottom: 12 }}>
            Simple pricing
          </h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 17, marginBottom: 56, marginTop: 0 }}>
            Start free. Upgrade when your team is ready.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {/* Free */}
            <div style={colStyle(false)}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Free</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>$0</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>/month</span>
              </div>
              <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>Everything you need to get started.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32, flex: 1 }}>
                {pricingFree.map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>
                    <Check /> {item}
                  </div>
                ))}
              </div>
              <Link href="/auth?tab=signup" style={{ display: 'block', textAlign: 'center', padding: '14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div style={colStyle(true)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pro</div>
                <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.2)', borderRadius: 99, padding: '3px 8px', letterSpacing: '0.04em' }}>POPULAR</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>$8</span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>/user/month</span>
              </div>
              <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>For teams that need more power.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32, flex: 1 }}>
                {pricingPro.map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: 'rgba(255,255,255,0.9)' }}>
                    <Check color="#fff" /> {item}
                  </div>
                ))}
              </div>
              <Link href="/auth?tab=signup" className="cta-white" style={{ display: 'block', textAlign: 'center', padding: '14px', background: '#fff', color: '#fa420f', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '96px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 700, letterSpacing: '-0.025em', marginTop: 0, marginBottom: 56 }}>
            Common questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {faq.map((item, i) => (
              <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '24px 0' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 10, letterSpacing: '-0.01em' }}>
                  {item.q}
                </div>
                <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>
                  {item.a}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA strip ── */}
      <section style={{ background: '#fa420f', padding: '72px 24px', textAlign: 'center' }}>
        <FlameIcon size={40} color="rgba(255,255,255,0.3)" />
        <h2 style={{ margin: '16px 0 12px', fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.025em', color: '#fff' }}>
          Ready to light up your workflow?
        </h2>
        <p style={{ margin: '0 0 36px', fontSize: 17, color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}>
          Join 500+ teams already doing it.
        </p>
        <Link href="/auth?tab=signup" className="cta-white" style={{ display: 'inline-block', padding: '16px 40px', background: '#fff', color: '#fa420f', borderRadius: 10, fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
          Create your free account
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '48px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <LumioWordmark height={22} color="rgba(255,255,255,0.35)" />
          <div style={{ display: 'flex', gap: 24 }}>
            {['Privacy', 'Terms', 'Contact'].map((link) => (
              <a key={link} href="#" style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>{link}</a>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.02em' }}>
            © 2026 Lumio. All rights reserved.
          </p>
        </div>
      </footer>

      {/* ── Mobile sticky CTA ── */}
      <div className="mobile-cta" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, padding: '12px 16px 28px', background: 'linear-gradient(to top, #0f0f0f 60%, transparent)', display: 'none', flexDirection: 'column', gap: 8 }}>
        <Link href="/auth?tab=signup" style={{ display: 'block', textAlign: 'center', padding: '16px', background: '#fa420f', color: '#fff', borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: 'none', boxShadow: '0 0 32px rgba(250,66,15,0.4)' }}>
          Get Started Free
        </Link>
      </div>
    </div>
  );
}
