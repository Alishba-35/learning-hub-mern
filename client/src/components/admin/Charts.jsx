// Halke, bina library ke charts. Rang CSS se aate hain (admin.css), is liye dark/light dono mein theek.

// Bars ka chart: har entry {label, value}. title screen reader ke liye poora summary hai.
export function BarChart({ data, title, height = 90 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const width = 300;
  const slot = width / data.length;
  return (
    <svg className="admin-bars" viewBox={`0 0 ${width} ${height + 14}`} role="img" aria-label={title} preserveAspectRatio="none">
      <title>{title}</title>
      {data.map((d, i) => {
        const h = d.value ? Math.max(3, (d.value / max) * height) : 1.5;
        return (
          <rect key={d.label} className={d.value ? 'bar' : 'bar bar-empty'} x={i * slot + slot * 0.15} y={height - h + 4} width={slot * 0.7} height={h} rx="2">
            <title>{`${d.label}: ${d.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

// Ek line ki progress bar (label, kitna, kitna mein se)
export function ProgressRow({ label, value, max, color, note }) {
  const percent = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="admin-progress-row">
      <div className="admin-progress-head">
        <span>{label}</span>
        <span className="admin-sub-inline">{note ?? `${percent}%`}</span>
      </div>
      <div className="admin-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span style={{ width: `${percent}%`, background: color || undefined }} />
      </div>
    </div>
  );
}
