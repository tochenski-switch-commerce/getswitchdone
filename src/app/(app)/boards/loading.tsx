export default function BoardsLoading() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', padding: '24px 16px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ width: 140, height: 28, background: '#1a1d2a', borderRadius: 8 }} />
          <div style={{ width: 100, height: 36, background: '#1a1d2a', borderRadius: 10 }} />
        </div>
        {/* Board cards skeleton grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              background: '#141621',
              borderRadius: 14,
              padding: 20,
              border: '1px solid #1e2130',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1a1d2a' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '70%', height: 16, background: '#1a1d2a', borderRadius: 6, marginBottom: 6 }} />
                  <div style={{ width: '40%', height: 12, background: '#1a1d2a', borderRadius: 4 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
