export default function BoardDetailLoading() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f1117' }}>
      {/* Top bar skeleton */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #1e2130',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1a1d2a' }} />
          <div style={{ width: 160, height: 20, borderRadius: 6, background: '#1a1d2a' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1a1d2a' }} />
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1a1d2a' }} />
        </div>
      </div>
      {/* Columns skeleton */}
      <div style={{ display: 'flex', gap: 16, padding: 16, overflowX: 'auto' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            minWidth: 280, background: '#141621', borderRadius: 12,
            padding: 12, border: '1px solid #1e2130', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a1d2a' }} />
              <div style={{ width: 80, height: 14, borderRadius: 4, background: '#1a1d2a' }} />
              <div style={{ marginLeft: 'auto', width: 20, height: 14, borderRadius: 4, background: '#1a1d2a' }} />
            </div>
            {Array.from({ length: 3 - i }).map((_, j) => (
              <div key={j} style={{
                background: '#191c29', borderRadius: 8, padding: 12, marginBottom: 8,
                border: '1px solid #1e2130',
              }}>
                <div style={{ width: '80%', height: 14, borderRadius: 4, background: '#1a1d2a', marginBottom: 8 }} />
                <div style={{ width: '50%', height: 10, borderRadius: 3, background: '#1a1d2a' }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
