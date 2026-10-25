// "Events" lesson ke live demos (purani public/js/event.js, ab lesson ke andar tak mehdood)
export function attachEventDemos(root) {
  const disposers = [];
  const on = (id, type, handler) => {
    const el = root.querySelector(`#${id}`);
    if (!el) return;
    el.addEventListener(type, handler);
    disposers.push(() => el.removeEventListener(type, handler));
  };
  const setText = (id, text) => {
    const el = root.querySelector(`#${id}`);
    if (el) el.textContent = text;
  };
  const clickDemo = () => setText('clickMsg', 'Button was clicked!');

  on('clickBtn', 'click', clickDemo);

  const hoverBtn = root.querySelector('#hoverBtn');
  on('hoverBtn', 'mouseover', () => hoverBtn && (hoverBtn.textContent = 'Mouse is over the button!'));
  on('hoverBtn', 'mouseout', () => hoverBtn && (hoverBtn.textContent = 'Hover Over Me'));

  on('keyboardInput', 'keydown', (e) => console.log(`Key Down: ${e.key}`));
  on('keyboardInput', 'keyup', (e) => console.log(`Key Up: ${e.key}`));

  on('googleLink', 'click', (e) => {
    e.preventDefault();
    alert("Default action prevented. Link won't open.");
  });

  on('myForm', 'submit', (e) => {
    e.preventDefault();
    setText('formMsg', 'Form submitted successfully!');
  });

  on('list', 'click', (e) => {
    if (e.target.tagName === 'LI') alert(`You clicked on ${e.target.textContent}`);
  });

  on('outerDiv', 'click', () => alert('Outer Div clicked!'));
  on('innerDiv', 'click', () => alert('Inner Div clicked!'));

  on('basicBtn', 'click', () => setText('basicMsg', 'Button was clicked!'));
  on('namedBtn', 'click', () => alert('Hello! You clicked the button!'));
  on('multiBtn', 'click', () => console.log('First action triggered'));
  on('multiBtn', 'click', () => console.log('Second action triggered'));

  on('actionBtn', 'click', () => setText('output', 'You single clicked the button!'));
  on('actionBtn', 'dblclick', () => setText('output', 'You double clicked the button!'));

  return () => disposers.forEach((fn) => fn());
}
