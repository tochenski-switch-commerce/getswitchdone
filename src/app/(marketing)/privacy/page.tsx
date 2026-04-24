import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Lumio',
  description: 'How Lumio collects, uses, and protects your data.',
};

function LumioWordmark({ height = 26, color = '#fff' }: { height?: number; color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 0 851 290" aria-label="Lumio" style={{ height, width: 'auto', color }}>
      <path fillRule="evenodd" fill="currentColor" transform="translate(0, -3.891)" d="M836.649,243.604 C828.405,257.165 817.226,267.951 803.100,275.964 C788.974,283.982 772.961,287.989 755.072,287.989 C737.177,287.989 721.169,283.982 707.043,275.964 C692.918,267.951 681.733,257.104 673.494,243.427 C665.251,229.756 661.134,214.427 661.134,197.451 C661.134,180.713 665.195,165.622 673.318,152.183 C681.440,138.744 692.564,128.078 706.690,120.176 C720.816,112.280 736.940,108.329 755.072,108.329 C772.729,108.329 788.676,112.219 802.923,119.100 C817.165,127.780 828.405,138.451 836.649,152.006 C844.887,165.567 849.009,180.713 849.009,197.451 C849.009,214.665 844.887,230.049 836.649,243.604 ZM788.621,177.116 C785.321,171.104 780.791,166.390 775.024,162.969 C769.253,159.554 762.604,157.841 755.072,157.841 C747.534,157.841 740.824,159.554 734.942,162.969 C729.055,166.390 724.464,171.164 721.169,177.293 C717.870,183.426 716.225,190.262 716.225,197.805 C716.225,205.823 717.870,212.957 721.169,219.201 C724.464,225.451 729.055,230.226 734.942,233.525 C740.824,236.829 747.534,238.476 755.072,238.476 C762.604,238.476 769.313,236.829 775.201,233.525 C781.083,230.226 785.619,225.451 788.797,219.201 C791.976,212.957 793.565,205.823 793.565,197.805 C793.565,190.024 791.915,183.128 788.621,177.116 Z" />
      <path fill="currentColor" d="M607.665,85.002 C599.884,85.002 593.331,82.269 587.998,76.798 C582.665,71.331 580.028,64.768 579.998,57.107 C579.941,42.541 586.944,32.765 592.177,28.186 C589.274,44.173 605.779,44.594 601.191,31.580 C594.742,10.187 607.500,0.000 607.500,0.000 C607.500,0.000 608.726,13.316 627.498,37.416 C631.946,43.126 634.998,49.231 634.998,57.107 C634.998,64.768 632.498,71.331 627.498,76.798 C622.498,82.269 615.883,85.002 607.665,85.002 ZM491.959,189.321 C491.959,183.425 490.900,178.297 488.781,173.937 C486.662,169.571 483.605,166.212 479.599,163.858 C475.598,161.498 470.892,160.321 465.473,160.321 C457.472,160.321 451.170,162.913 446.579,168.101 C441.989,173.285 439.693,180.358 439.693,189.321 L439.693,287.993 L439.283,287.993 L385.308,287.993 L384.898,287.993 L384.898,189.321 C384.898,183.425 383.839,178.297 381.720,173.937 C379.601,169.571 376.544,166.212 372.538,163.858 C368.538,161.498 363.831,160.321 358.412,160.321 C350.411,160.321 344.110,162.913 339.519,168.101 C334.928,173.285 332.633,180.358 332.633,189.321 L332.633,287.993 L278.248,287.993 L278.248,188.614 C278.248,173.522 281.603,160.260 288.313,148.827 C295.022,137.388 304.381,128.431 316.388,121.949 C328.395,115.467 342.405,112.223 358.412,112.223 C373.951,112.223 387.900,115.528 400.260,122.126 C404.440,124.356 408.295,126.871 411.842,129.655 C415.390,126.787 419.254,124.213 423.448,121.949 C435.455,115.467 449.465,112.223 465.473,112.223 C481.011,112.223 494.961,115.528 507.321,122.126 C519.681,128.724 529.277,137.742 536.103,149.181 C542.934,160.614 546.344,173.760 546.344,188.614 L546.344,287.993 L491.959,287.993 L491.959,189.321 ZM210.814,278.263 C198.807,284.745 184.797,287.989 168.789,287.989 C153.251,287.989 139.302,284.684 126.941,278.086 C114.581,271.488 104.986,262.470 98.160,251.031 C91.329,239.598 87.918,226.451 87.918,211.598 L87.918,112.219 L142.303,112.219 L142.303,210.890 C142.303,216.787 143.363,221.915 145.482,226.275 C147.601,230.640 150.657,233.100 154.664,236.354 C158.664,238.714 163.371,239.891 168.789,239.891 C176.790,239.891 183.092,237.299 187.683,232.110 C192.274,226.927 194.569,219.854 194.569,210.890 L194.569,112.219 L248.954,112.219 L248.954,211.598 C248.954,226.689 245.599,239.951 238.889,251.385 C232.179,262.823 222.821,271.781 210.814,278.263 ZM-0.015,27.340 L54.369,27.340 L54.369,284.098 L-0.015,284.098 L-0.015,27.340 ZM634.648,284.098 L580.263,284.098 L580.263,112.219 L634.648,112.219 L634.648,284.098 Z" />
    </svg>
  );
}

const sections = [
  {
    title: 'What We Collect',
    body: `When you create an account we collect your email address, name, and a password hash — we never store your plaintext password. As you use Lumio we store the content you create: boards, columns, cards, comments, and any files or attachments you upload. We also collect basic usage data such as page views, feature interactions, and error logs so we can improve the product. If you enable push notifications we store a device token to route alerts to your device.`,
  },
  {
    title: 'How We Use Your Data',
    body: `We use your data solely to operate and improve Lumio. That means: delivering the product to you and your team, sending transactional emails (account confirmation, password reset, notifications you've opted into), providing AI-powered features when you use them, debugging errors, and understanding how the product is used in aggregate. We do not sell your data, use it for advertising, or share it with third parties beyond what is described below.`,
  },
  {
    title: 'Third-Party Services',
    body: `Lumio is built on a small set of trusted sub-processors:\n\n• Supabase — hosts our PostgreSQL database and authentication system. Your data is stored on Supabase infrastructure.\n• OpenAI — processes text when you use AI features (chat assistant, card extraction, autopilot). Text is sent to OpenAI's API and subject to their data usage policies.\n• Resend — delivers transactional emails on our behalf.\n• Netlify — serves the web application.\n• Apple (APNs) — delivers push notifications to iOS devices.\n• Stripe — processes payments for Pro subscriptions. We do not store card numbers; Stripe handles all payment data.\n\nEach sub-processor is bound by a data processing agreement and handles your data only as needed to provide their service.`,
  },
  {
    title: 'Data Retention',
    body: `We keep your data for as long as your account is active. If you delete your account, your profile, boards, and cards are permanently deleted within 30 days. Aggregated, anonymised usage statistics may be retained indefinitely. Backups are rotated on a rolling 30-day window and will expire naturally after deletion.`,
  },
  {
    title: 'Your Rights',
    body: `You can export your board data at any time from your account settings. You can request deletion of your account and all associated data by emailing us or using the delete account option in Profile & Settings. If you are located in the EU or UK, you have rights under GDPR/UK GDPR including access, rectification, erasure, portability, and the right to object to processing. To exercise any of these rights, email hello@lumio.app.`,
  },
  {
    title: 'Security',
    body: `All data is encrypted in transit via TLS. Data at rest is encrypted by our infrastructure provider. We use short-lived session tokens for authentication and enforce Row-Level Security on our database so users can only access their own data. We conduct periodic security reviews and address vulnerabilities promptly. No system is 100% secure; if you believe you have found a security issue, please disclose it responsibly to hello@lumio.app.`,
  },
  {
    title: 'Cookies',
    body: `We use a single session cookie to keep you logged in. We do not use advertising cookies or tracking pixels. No third-party analytics scripts run on Lumio pages.`,
  },
  {
    title: 'Changes to This Policy',
    body: `We may update this policy as the product evolves. If we make material changes we will notify you by email at least 14 days before they take effect. The date at the top of this page always reflects the most recent revision.`,
  },
  {
    title: 'Contact',
    body: `Questions about privacy? Email us at hello@lumio.app. We aim to respond within 2 business days.`,
  },
];

export default function PrivacyPage() {
  return (
    <div style={{ background: '#0f0f0f', color: '#fff', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", minHeight: '100vh' }}>
      <style>{`
        a.lp-nav-link:hover { color: #fff !important; }
        .lp-prose h2 { font-size: 18px; font-weight: 700; color: #f9fafb; margin: 40px 0 12px; letter-spacing: -0.01em; }
        .lp-prose p { margin: 0 0 16px; }
        .lp-prose p:last-child { margin-bottom: 0; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(15,15,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link href="/landing" style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}>
            <LumioWordmark height={24} color="#ffffff" />
          </Link>
          <Link href="/auth" className="lp-nav-link" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
            Sign In
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '56px 24px 48px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#fa420f', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Legal</p>
          <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Privacy Policy
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.4)' }}>
            Last updated: April 24, 2026
          </p>
        </div>
      </div>

      {/* Intro */}
      <div style={{ padding: '40px 24px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <p style={{ margin: 0, fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75 }}>
            Lumio is built on the principle that your work data belongs to you. This policy explains what we collect, why we collect it, and how you can control it. We have written it to be readable — if something is unclear, email us at{' '}
            <a href="mailto:hello@lumio.app" style={{ color: '#fa420f', textDecoration: 'none' }}>hello@lumio.app</a>.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div style={{ padding: '16px 24px 96px' }}>
        <div className="lp-prose" style={{ maxWidth: 720, margin: '0 auto', fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75 }}>
          {sections.map((s) => (
            <div key={s.title}>
              <h2>{s.title}</h2>
              {s.body.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '40px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <LumioWordmark height={20} color="rgba(255,255,255,0.25)" />
          <div style={{ display: 'flex', gap: 24 }}>
            <Link href="/privacy" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontWeight: 500 }}>Privacy</Link>
            <Link href="/terms" style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>Terms</Link>
            <a href="mailto:hello@lumio.app" style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>Contact</a>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.15)' }}>© 2026 Lumio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
