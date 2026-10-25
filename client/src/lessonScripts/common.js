const actions = {
  showWindowInfo() {
    alert(`Window width: ${window.innerWidth}px\nWindow height: ${window.innerHeight}px`);
  },
  changeText(root) {
    const el = root.querySelector('#demo-text');
    if (el) el.textContent = 'Updated Text via JavaScript!';
  },
};

// Lesson ke andar: internal links SPA se khulte hain, demo forms page reload nahi karte,
// aur data-action wale buttons chalte hain (purane onclick="..." ki jagah).
export function attachCommon(root, { navigate }) {
  const onClick = (e) => {
    const link = e.target.closest?.('a[href]');
    if (link && root.contains(link)) {
      const href = link.getAttribute('href');
      if (href.startsWith('/') && !href.startsWith('//')) {
        e.preventDefault();
        navigate(href);
        return;
      }
      if (href === '#') e.preventDefault();
    }
    const actionEl = e.target.closest?.('[data-action]');
    if (actionEl && root.contains(actionEl)) actions[actionEl.dataset.action]?.(root);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const message = e.target.closest?.('form')?.dataset.demoAlert;
    if (message) alert(message);
  };

  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('submit', onSubmit);
  };
}
