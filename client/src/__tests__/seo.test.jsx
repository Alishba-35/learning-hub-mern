// SEO: index.html ke tags, robots.txt, sitemap.xml aur har page ka apna title (usePageTitle)
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { usePageTitle } from '../hooks/usePageTitle.js';

const html = readFileSync('index.html', 'utf8');
const SITE = 'https://learning-hub-lilac-theta.vercel.app';

describe('index.html', () => {
  it('has a title, description, canonical link, social preview tags and structured data', () => {
    expect(html).toMatch(/<title>Learning Hub \| [^<]{20,}<\/title>/);
    expect(html).toMatch(/name="description"\s+content="[^"]{80,200}"/);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/" />`);
    for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type']) expect(html).toContain(`property="${tag}"`);
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain(`content="${SITE}/og-image.png"`);
    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
    expect(JSON.parse(jsonLd)).toMatchObject({ '@type': 'WebSite', name: 'Learning Hub', url: `${SITE}/` });
    expect(html).toContain('<noscript>');
    expect(html).toContain('lang="en"');
  });

  it('has a social image of the right size', () => {
    const png = readFileSync('public/og-image.png');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});

describe('robots.txt and sitemap.xml', () => {
  const robots = readFileSync('public/robots.txt', 'utf8');
  const sitemap = readFileSync('public/sitemap.xml', 'utf8');
  it('keep private pages out of search and point to the sitemap', () => {
    for (const path of ['/api/', '/dashboard', '/learn/', '/admin', '/verify/']) expect(robots).toContain(`Disallow: ${path}`);
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(robots).not.toMatch(/^Disallow: \/$/m);
  });
  it('lists only the public pages', () => {
    expect([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])).toEqual([`${SITE}/`, `${SITE}/login`]);
  });
});

describe('usePageTitle', () => {
  afterEach(() => {
    cleanup();
    document.title = '';
    document.head.querySelectorAll('meta[name="robots"],meta[name="description"]').forEach((m) => m.remove());
  });
  function Page(props) {
    usePageTitle(props.title, props.options);
    return null;
  }
  it('sets the title with the site name and restores it afterwards', () => {
    document.title = 'before';
    const { unmount } = render(<Page title="Dashboard" />);
    expect(document.title).toBe('Dashboard | Learning Hub');
    unmount();
    expect(document.title).toBe('before');
  });
  it('can set a description, and marks private pages noindex only while they are open', () => {
    const { unmount } = render(<Page title="Admin" options={{ noindex: true, description: 'Hello' }} />);
    expect(document.head.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow');
    expect(document.head.querySelector('meta[name="description"]').content).toBe('Hello');
    unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
  });
  it('bare titles skip the site suffix', () => {
    render(<Page title="Learn to code for free" options={{ bare: true }} />);
    expect(document.title).toBe('Learn to code for free');
  });
});
