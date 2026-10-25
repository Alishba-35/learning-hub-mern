// Study Buddy ka chehra: apna banaya hua chhota SVG
export default function Orb({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="orbGlow" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#bfe9d6" />
          <stop offset="0.55" stopColor="#4fb38a" />
          <stop offset="1" stopColor="#1f5e4a" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#orbGlow)" />
      <ellipse cx="24" cy="31" rx="3.2" ry="4.6" fill="#0b1d17" />
      <ellipse cx="40" cy="31" rx="3.2" ry="4.6" fill="#0b1d17" />
    </svg>
  );
}
