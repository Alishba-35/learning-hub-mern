// Learning Hub ka logo. Do shaklein: "full" (emblem + naam) aur "icon" (sirf emblem, chhoti jagah ke liye).
// Do rang: gehre (navy) logo roshan background ke liye, aur halka (safed) logo gehre background ke liye.
//   surface="dark"  -> halka logo (jahan background hamesha gehra ho: landing, login, dashboard)
//   surface="light" -> gehra logo
//   surface="auto"  -> theme ke hisab se (dono bante hain, CSS ek chhupa deta hai)
// decorative: jahan saath mein "Learning Hub" likha ho wahan alt khali rakhein.
const FILES = {
  full: { dark: '/images/logo-light.png', light: '/images/logo.png' },
  icon: { dark: '/images/logo-icon-light.png', light: '/images/logo-icon.png' },
};

export default function BrandLogo({ size = 40, variant = 'full', surface = 'dark', decorative = false, className = '' }) {
  const alt = decorative ? '' : 'Learning Hub logo';
  const show = surface === 'auto' ? ['dark', 'light'] : [surface];
  return (
    <>
      {show.map((on) => (
        <img
          key={on}
          src={FILES[variant][on]}
          alt={alt}
          width={size}
          height={size}
          className={`brand-logo${surface === 'auto' ? ` brand-logo--auto-${on}` : ''} ${className}`.trim()}
          draggable="false"
        />
      ))}
    </>
  );
}
