// Learning Hub ka logo (public/images/logo.png). Jahan saath mein "Learning Hub" likha ho wahan decorative rakho (alt khali)
export default function BrandLogo({ size = 40, decorative = false, className = '' }) {
  return (
    <img
      src="/images/logo.png"
      alt={decorative ? '' : 'Learning Hub logo'}
      width={size}
      height={size}
      className={`brand-logo ${className}`.trim()}
      draggable="false"
    />
  );
}
