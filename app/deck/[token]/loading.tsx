export default function DeckLoading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#2A4227',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '28px',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <style>{`
        @keyframes deckPulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.25; }
        }
      `}</style>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(156,193,150,0.3)',
          animation: 'deckPulse 1.8s ease-in-out infinite',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        {([280, 200, 140] as const).map((w, i) => (
          <div
            key={w}
            style={{
              width: w,
              height: i === 0 ? 18 : 12,
              borderRadius: 6,
              background: 'rgba(255,255,255,0.1)',
              animation: `deckPulse 1.8s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
