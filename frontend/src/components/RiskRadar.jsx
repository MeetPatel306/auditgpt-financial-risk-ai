export default function RiskRadar({ data }) {
  const categories = data.risk_categories

  function getColor(score) {
    if (score >= 75) return '#ef4444'
    if (score >= 55) return '#f97316'
    if (score >= 35) return '#eab308'
    return '#22c55e'
  }

  return (
    <div className="card" style={{ padding: '24px', height: '100%' }}>
      <h3 style={{
        fontFamily: 'Poppins', fontWeight: 700, fontSize: '0.8rem',
        letterSpacing: '0.1em', color: 'var(--text-muted)',
        textTransform: 'uppercase', margin: '0 0 20px',
      }}>
        Risk Breakdown
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {categories.map((cat, i) => {
          const color = getColor(cat.score)
          const width = cat.score
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{
                  color: 'var(--text-secondary)', fontSize: '0.72rem',
                  fontFamily: 'Inter', fontWeight: 500,
                }}>
                  {cat.category}
                </span>
                <span style={{
                  color, fontSize: '0.72rem',
                  fontFamily: 'JetBrains Mono', fontWeight: 500,
                }}>
                  {cat.score}
                </span>
              </div>
              {/* Bar track */}
              <div style={{
                height: '6px', borderRadius: '3px',
                background: 'var(--border)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${width}%`,
                  borderRadius: '3px',
                  background: `linear-gradient(90deg, ${color}99, ${color})`,
                  boxShadow: `0 0 8px ${color}66`,
                  transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transitionDelay: `${i * 0.08}s`,
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {[
          ['≥75 Critical', '#ef4444'],
          ['≥55 High', '#f97316'],
          ['≥35 Moderate', '#eab308'],
          ['<35 Low', '#22c55e'],
        ].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'JetBrains Mono' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
