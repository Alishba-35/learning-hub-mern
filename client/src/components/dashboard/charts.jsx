import { formatDay } from '../../utils/format.js';

const toPoints = (values, width, height, pad = 6) => {
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((v, i) => [i * step, height - pad - (v / max) * (height - pad * 2)]);
};
const line = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

// Chhoti line (stat cards ke andar)
export function Sparkline({ values, label }) {
  const pts = toPoints(values, 100, 30, 3);
  return (
    <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={line(pts)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Chhote bars (pichle 7 din)
export function MiniBars({ values, label }) {
  const max = Math.max(...values, 1);
  return (
    <svg className="bars" viewBox="0 0 70 30" role="img" aria-label={label}>
      {values.map((v, i) => {
        const h = Math.max(3, (v / max) * 28);
        return <rect key={i} x={i * 10 + 1} y={30 - h} width="6" height={h} rx="3" fill="currentColor" opacity={v > 0 ? 1 : 0.3} />;
      })}
    </svg>
  );
}

// Bara chart: pichle 14 din ka XP
export function AreaChart({ series }) {
  const values = series.map((d) => d.xp);
  const W = 560;
  const H = 170;
  const pts = toPoints(values, W, H, 12);
  const total = values.reduce((n, v) => n + v, 0);
  const max = Math.max(...values, 0);
  const area = `${line(pts)} L${W} ${H} L0 ${H} Z`;
  const labelDays = [series[0], series[Math.floor(series.length / 2)], series[series.length - 1]];

  return (
    <figure className="area-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`XP per day for the last ${series.length} days. Total ${total} XP, best day ${max} XP.`}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="currentColor" strokeOpacity="0.12" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill="url(#areaFill)" />
        <path d={line(pts)} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="area-axis" aria-hidden="true">
        {labelDays.map((d) => (
          <span key={d.day}>{formatDay(d.day)}</span>
        ))}
      </figcaption>
    </figure>
  );
}

// Gol gauge (percent)
export function Donut({ percent, size = 96, stroke = 10, color = 'currentColor', children, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * c;
  return (
    <div className="donut" style={{ width: size, height: size }} role="img" aria-label={label ?? `${percent}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="donut-text">{children ?? `${percent}%`}</span>
    </div>
  );
}
