import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthProvider.jsx';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const user = { id: '1', name: 'Test', email: 't@example.com', role: 'student', purpose: '' };

const htmlLang = {
  language: { slug: 'html', name: 'HTML', description: '', color: '#000' },
  topics: [
    { slug: 'intro', title: 'Introduction', section: 'Getting Started', order: 1 },
    { slug: 'tags', title: 'Basic Tags', section: 'Getting Started', order: 2 },
    { slug: 'forms', title: 'Forms', section: 'Tables & Forms', order: 3 },
  ],
};
const lesson = (slug, title, blocks, prev = null, next = null) => ({
  topic: { slug, title, order: 1, blocks, styles: '' },
  prev,
  next,
});
const h1 = (text) => ({ kind: 'html', html: `<h1>${text}</h1>` });

function mockApi(extra = {}) {
  const routes = {
    '/api/auth/refresh': () => json(200, { accessToken: 'tok', user }),
    '/api/languages/html': () => json(200, htmlLang),
    '/api/languages/html/topics/intro': () =>
      json(200, lesson('intro', 'Introduction', [h1('Intro lesson')], null, { slug: 'tags', title: 'Basic Tags' })),
    '/api/languages/html/topics/tags': () =>
      json(
        200,
        lesson('tags', 'Basic Tags', [h1('Tags lesson')], { slug: 'intro', title: 'Introduction' }, { slug: 'forms', title: 'Forms' })
      ),
    '/api/languages/html/topics/forms': () =>
      json(200, lesson('forms', 'Forms', [h1('Forms lesson')], { slug: 'tags', title: 'Basic Tags' }, null)),
    ...extra,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => (routes[url] ? routes[url]() : json(404, { message: 'Not found' })))
  );
}

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('lesson navigation', () => {
  it('opens the first topic of a language and shows Back + Next', async () => {
    mockApi();
    renderApp('/learn/html');
    expect(await screen.findByRole('heading', { name: 'Intro lesson' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '<= Back' }).getAttribute('href')).toBe('/languages');
    expect(screen.getByRole('link', { name: 'Next =>' }).getAttribute('href')).toBe('/learn/html/tags');
    expect(screen.queryByRole('link', { name: '<= Previous' })).toBeNull();
  });

  it('moves between topics and hides Next on the last one', async () => {
    mockApi();
    renderApp('/learn/html/intro');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('link', { name: 'Next =>' }));
    expect(await screen.findByRole('heading', { name: 'Tags lesson' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '<= Previous' }).getAttribute('href')).toBe('/learn/html/intro');
    await u.click(screen.getByRole('link', { name: 'Next =>' }));
    expect(await screen.findByRole('heading', { name: 'Forms lesson' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Next =>' })).toBeNull();
  });

  it('opens and closes the topics sidebar and lists every topic', async () => {
    mockApi();
    const { container } = renderApp('/learn/html/intro');
    const u = userEvent.setup();
    await screen.findByRole('heading', { name: 'Intro lesson' });
    const sidebar = container.querySelector('.topics-sidebar');
    expect(sidebar.getAttribute('aria-hidden')).toBe('true');

    await u.click(screen.getByRole('button', { name: 'Toggle topics sidebar' }));
    expect(sidebar.getAttribute('aria-hidden')).toBe('false');
    expect(sidebar.classList.contains('is-open')).toBe(true);
    expect(Array.from(sidebar.querySelectorAll('nav a')).map((a) => a.textContent)).toEqual([
      'Introduction',
      'Basic Tags',
      'Forms',
    ]);
    // topics are grouped under section headings, each heading shown once
    expect(Array.from(sidebar.querySelectorAll('.topics-section')).map((h) => h.textContent)).toEqual([
      'Getting Started',
      'Tables & Forms',
    ]);

    await u.click(screen.getByRole('link', { name: 'Forms' }));
    expect(await screen.findByRole('heading', { name: 'Forms lesson' })).toBeTruthy();
    expect(sidebar.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows Page not found for unknown language and unknown topic', async () => {
    mockApi();
    renderApp('/learn/fortran');
    expect(await screen.findByText('Page not found')).toBeTruthy();
    cleanup();
    renderApp('/learn/html/zzz');
    expect(await screen.findByText('Page not found')).toBeTruthy();
  });

  it('keeps the lesson behind login', async () => {
    mockApi({ '/api/auth/refresh': () => json(401, { message: 'Session expired' }) });
    renderApp('/learn/html/intro');
    expect(await screen.findByRole('heading', { name: /login/i })).toBeTruthy();
  });
});

describe('lesson content safety', () => {
  it('keeps form validation attributes so the Forms lesson demo works', async () => {
    const form = {
      kind: 'html',
      html: '<form data-demo-alert="ok"><input id="e" type="email" required minlength="3" maxlength="20" pattern="[a-z]+" title="letters"><button>Go</button></form>',
    };
    mockApi({ '/api/languages/html/topics/intro': () => json(200, lesson('intro', 'Introduction', [form])) });
    const { container } = renderApp('/learn/html/intro');
    await screen.findByRole('button', { name: 'Go' });
    const input = container.querySelector('#e');
    for (const a of ['required', 'minlength', 'maxlength', 'pattern', 'title']) expect(input.hasAttribute(a), a).toBe(true);
    expect(container.querySelector('form').dataset.demoAlert).toBe('ok');
  });

  it('strips scripts, handlers and foreign iframes but keeps YouTube and safe links', async () => {
    const evil = {
      kind: 'html',
      html:
        '<p id="ok">Hello</p><script>window.__pwned = 1</script><img src="/x.png" onerror="window.__pwned = 2">' +
        '<iframe src="https://evil.example/x"></iframe><iframe src="https://www.youtube.com/embed/abc"></iframe>' +
        '<a href="https://example.com">out</a><form action="https://evil.example"><input name="a"></form>',
    };
    mockApi({ '/api/languages/html/topics/intro': () => json(200, lesson('intro', 'Introduction', [evil])) });
    const { container } = renderApp('/learn/html/intro');
    await screen.findByText('Hello');

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img').hasAttribute('onerror')).toBe(false);
    const frames = container.querySelectorAll('.lesson iframe');
    expect(frames.length).toBe(1);
    expect(frames[0].getAttribute('src')).toBe('https://www.youtube.com/embed/abc');
    const link = screen.getByRole('link', { name: 'out' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.querySelector('form').hasAttribute('action')).toBe(false);
    expect(window.__pwned).toBeUndefined();
  });
});

describe('lesson blocks', () => {
  it('C++ demo shows the recorded output on Run and clears on Clear', async () => {
    const demo = { kind: 'demo', language: 'cpp', code: 'cout << "hi";', output: 'hi there' };
    mockApi({ '/api/languages/html/topics/intro': () => json(200, lesson('intro', 'Introduction', [demo])) });
    const { container } = renderApp('/learn/html/intro');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Run demo' }));
    const out = container.querySelector('.output-box');
    await waitFor(() => expect(out.textContent).toBe('Output:\nhi there'));
    await u.click(screen.getByRole('button', { name: 'Clear' }));
    expect(out.textContent).toBe('');
  });

  it('JavaScript playground uses a locked-down iframe and only trusts messages from it', async () => {
    const pg = { kind: 'playground', language: 'javascript', code: 'console.log("start")' };
    mockApi({ '/api/languages/html/topics/intro': () => json(200, lesson('intro', 'Introduction', [pg])) });
    const { container } = renderApp('/learn/html/intro');
    const u = userEvent.setup();
    const editor = await screen.findByLabelText('Code editor');
    fireEvent.change(editor, { target: { value: 'console.log("x"); </script><script>alert(1)</script>' } });
    await u.click(screen.getByRole('button', { name: 'Run Code' }));

    const frame = container.querySelector('iframe[title="code runner"]');
    // no same-origin: the code cannot touch this app's cookies, tokens or DOM
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    // user code is embedded as JSON with "<" escaped, so a closing script tag cannot break out
    const doc = frame.getAttribute('srcdoc');
    expect(doc).not.toContain('</script><script>alert(1)');
    expect(doc).toContain('\\u003c/script');

    const fromFrame = (data) =>
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data, source: frame.contentWindow }));
      });
    // a message from somewhere else (not our iframe) is ignored
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { runId: 1, type: 'log', text: 'spoofed' }, source: window }));
    });
    expect(screen.queryByText('spoofed')).toBeNull();

    fromFrame({ runId: 1, type: 'log', text: 'Hello {"a":1}' });
    fromFrame({ runId: 1, type: 'error', text: 'boom' });
    fromFrame({ runId: 0, type: 'log', text: 'old run' }); // stale run id is ignored
    expect(screen.getByText('Hello {"a":1}')).toBeTruthy();
    expect(screen.getByText('Error: boom')).toBeTruthy();
    expect(screen.queryByText('old run')).toBeNull();

    expect(screen.getByRole('button', { name: 'Running...' })).toBeTruthy();
    fromFrame({ runId: 1, type: 'done', text: '' });
    expect(screen.getByRole('button', { name: 'Run Code' })).toBeTruthy();
  });
});

describe('lesson structure', () => {
  it('keeps a demo inside the card it belongs to (blocks are stitched back together)', async () => {
    const blocks = [
      { kind: 'html', html: '<div class="card"><h2>Loops</h2><p>before</p>' },
      { kind: 'demo', language: 'cpp', code: 'x', output: 'y' },
      { kind: 'html', html: '<p>after</p></div><p id="outside">outside</p>' },
    ];
    mockApi({ '/api/languages/html/topics/intro': () => json(200, lesson('intro', 'Introduction', blocks)) });
    const { container } = renderApp('/learn/html/intro');
    await screen.findByText('before');
    const card = container.querySelector('.card');
    expect(card.querySelector('.output-box')).toBeTruthy();
    expect(card.textContent).toContain('after');
    expect(card.textContent).not.toContain('outside');
  });
});

describe('lesson scripts (replacing the old inline handlers)', () => {
  const jsLang = {
    language: { slug: 'javascript', name: 'JavaScript', description: '', color: '#000' },
    topics: [{ slug: 'event', title: 'Events', order: 1 }],
  };
  const page = (html) => () => json(200, lesson('event', 'Events', [{ kind: 'html', html }]));

  it('Events demo buttons work and data-action buttons run', async () => {
    mockApi({
      '/api/languages/javascript': () => json(200, jsLang),
      '/api/languages/javascript/topics/event': page(
        '<button id="clickBtn">Click</button><p id="clickMsg"></p>' +
          '<button data-action="changeText">Change</button><p id="demo-text">Original</p>'
      ),
    });
    renderApp('/learn/javascript/event');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Click' }));
    expect(screen.getByText('Button was clicked!')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByText('Updated Text via JavaScript!')).toBeTruthy();
  });

  it('demo forms never reload the page and can show their alert', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockApi({
      '/api/languages/javascript': () => json(200, jsLang),
      '/api/languages/javascript/topics/event': page('<form data-demo-alert="Form submitted!"><button>Send</button></form>'),
    });
    renderApp('/learn/javascript/event');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Send' }));
    expect(alertSpy).toHaveBeenCalledWith('Form submitted!');
  });

  it('class demo renders the student with textContent, not HTML', async () => {
    mockApi({
      '/api/languages/javascript': () => json(200, { ...jsLang, topics: [{ slug: 'class', title: 'Class', order: 1 }] }),
      '/api/languages/javascript/topics/class': () =>
        json(200, lesson('class', 'Class', [{
          kind: 'html',
          html:
            '<form id="studentForm"><input id="studentName"><input id="studentAge"><input id="studentCourse"><button>Create</button></form><div id="result"></div>',
        }])),
    });
    const { container } = renderApp('/learn/javascript/class');
    const u = userEvent.setup();
    await screen.findByRole('button', { name: 'Create' });
    await u.type(container.querySelector('#studentName'), '<b id="x">Ali</b>');
    await u.type(container.querySelector('#studentAge'), '20');
    await u.type(container.querySelector('#studentCourse'), 'JS');
    await u.click(screen.getByRole('button', { name: 'Create' }));
    expect(container.querySelector('#result').textContent).toContain('<b id="x">Ali</b>');
    expect(container.querySelector('#x')).toBeNull();
  });

  it('internal links inside a lesson navigate inside the app', async () => {
    mockApi({
      '/api/languages/html/topics/intro': () =>
        json(200, lesson('intro', 'Introduction', [{ kind: 'html', html: '<a href="/learn/html/tags">go to tags</a>' }])),
    });
    renderApp('/learn/html/intro');
    await userEvent.setup().click(await screen.findByRole('link', { name: 'go to tags' }));
    expect(await screen.findByRole('heading', { name: 'Tags lesson' })).toBeTruthy();
  });
});
