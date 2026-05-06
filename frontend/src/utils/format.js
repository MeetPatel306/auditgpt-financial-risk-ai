export function formatCurrency(value) {
  if (value == null || isNaN(value)) return 'N/A'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}₹${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${sign}₹${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`
  return `${sign}₹${abs.toFixed(0)}`
}

export function formatNumber(value) {
  if (value == null || isNaN(value)) return 'N/A'
  return new Intl.NumberFormat('en-IN').format(Math.round(value))
}

export function getRiskConfig(level) {
  const configs = {
    CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', label: 'CRITICAL RISK' },
    HIGH:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', label: 'HIGH RISK' },
    MODERATE: { color: '#eab308', bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.3)',  label: 'MODERATE RISK' },
    LOW:      { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  label: 'LOW RISK' },
  }
  return configs[level] || configs.MODERATE
}
