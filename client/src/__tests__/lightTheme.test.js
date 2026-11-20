import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Vitest CSS imports ko khali kar deta hai, is liye file seedha disk se (tests client folder se chalte hain)
const css = readFileSync('src/styles/theme.css', 'utf8');

// Light theme ke rang CSS file se padh kar check karta hai (browser ke bagair): padhne layak contrast, aur dark pages dark hi rahen.

const block = (selector) => {
  const start = css.indexOf(selector);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('\n}', open));
};
const vars = (body) => Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const light = vars(block(":root[data-theme='light'] {"));
const forcedDark = vars(block(":root[data-theme='light'] .page-plum,"));

const channel = (x) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const h = hex === 'whitesmoke' ? '#f5f5f5' : hex;
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('soft light theme', () => {
  const surfaces = ['--app-bg', '--nav-bg', '--card-bg', '--c-0f172a', '--c-1e293b', '--c-172049', '--c-1e0f3a', '--c-0a1f35', '--c-0b1220', '--c-1e3a8a', '--c-424c5c', '--c-2e2e2e'];
  const texts = ['--text', '--c-e2e8f0', '--c-cbd5e1', '--c-94a3b8', '--c-a0abd0', '--c-888', '--c-c5d1ff', '--c-38bdf8', '--c-2281a9', '--c-4ade80', '--c-f87171', '--c-f8d866', '--c-fbbf24', '--c-f8f8f8'];

  it('every text colour is readable (4.5:1) on every surface colour', () => {
    const bad = [];
    for (const t of texts) for (const s of surfaces) if (contrast(light[t], light[s]) < 4.5) bad.push(`${t} on ${s}: ${contrast(light[t], light[s]).toFixed(2)}`);
    expect(bad).toEqual([]);
  });

  it('uses no pure white anywhere in the palette, and the page is clearly softer than before', () => {
    for (const [name, value] of Object.entries(light)) {
      if (/^#(f{3}|f{6})$/i.test(value)) throw new Error(`${name} is pure white`);
    }
    expect(luminance(light['--app-bg'])).toBeLessThan(0.75); // pehle #e4eaf4 = 0.82 tha
    expect(luminance(light['--card-bg'])).toBeLessThan(0.8);
  });
});

describe('dark pages stay dark in light mode (languages page, welcome, login)', () => {
  it('give the card and page colours back their dark values', () => {
    // Bug: .lang-card ka background --card-bg se aata hai; ye light ho jata to safed description text nazar nahi aata
    expect(forcedDark['--card-bg']).toBe('#202040');
    expect(forcedDark['--text']).toBe('#e2e8f0');
    expect(forcedDark['--app-bg']).toBe('#0f172a');
  });

  it('the language card text (whitesmoke) is easy to read on the card colour it gets in light mode', () => {
    expect(contrast('whitesmoke', forcedDark['--card-bg'])).toBeGreaterThan(10);
  });
});
