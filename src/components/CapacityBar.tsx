export default function CapacityBar({ count, capacity }: { count: number; capacity: number }) {
  const pct = capacity > 0 && isFinite(capacity) ? Math.min(100, (count / capacity) * 100) : 0
  const cls = pct >= 100 ? 'full' : pct >= 80 ? 'warn' : ''
  return (
    <div>
      <div className="capacity-bar">
        <div className={`capacity-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
        {count}/{isFinite(capacity) ? capacity : '∞'}
      </div>
    </div>
  )
}
