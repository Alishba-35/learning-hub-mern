// Profile photo, ya photo na ho to naam ka pehla harf
export default function Avatar({ user, className = '' }) {
  const initial = (user?.name || '?').trim()[0]?.toUpperCase() || '?';
  if (user?.avatar) return <img src={user.avatar} alt="" className={`avatar-img ${className}`.trim()} draggable="false" />;
  return (
    <span className={`avatar-initial ${className}`.trim()} aria-hidden="true">
      {initial}
    </span>
  );
}
