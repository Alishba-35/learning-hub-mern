import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../context/ThemeProvider.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const html = document.documentElement;
const mount = () => render(<ThemeProvider><ThemeToggle /></ThemeProvider>);

afterEach(() => {
  cleanup();
  localStorage.clear();
  html.removeAttribute('data-theme');
  html.removeAttribute('data-bs-theme');
});

describe('theme toggle', () => {
  it('starts dark, switches to light, and remembers the choice', async () => {
    mount();
    expect(html.getAttribute('data-theme')).toBe('dark');
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(html.getAttribute('data-theme')).toBe('light');
    expect(html.getAttribute('data-bs-theme')).toBe('light');
    expect(localStorage.getItem('lh-theme')).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeTruthy();
  });

  it('uses the saved theme on the next visit and can go back to dark', async () => {
    localStorage.setItem('lh-theme', 'light');
    mount();
    expect(html.getAttribute('data-theme')).toBe('light');
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(html.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('lh-theme')).toBe('dark');
  });

  it('ignores a bad saved value', () => {
    localStorage.setItem('lh-theme', 'purple');
    mount();
    expect(html.getAttribute('data-theme')).toBe('dark');
  });
});
