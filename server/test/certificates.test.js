// Certificates: PDF banane wala, code, aur issue / verify / download ke raaste (bina MongoDB ke).
import test, { after, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.MONGO_URI = 'mongodb://unused';
process.env.JWT_ACCESS_SECRET = 'certificate-test-secret-certificate-test-secret-1';
process.env.CLIENT_ORIGIN = 'https://learning-hub.example/';

const { default: app } = await import('../src/app.js');
const { default: Certificate } = await import('../src/models/Certificate.js');
const { default: Language } = await import('../src/models/Language.js');
const { default: Topic } = await import('../src/models/Topic.js');
const { default: Progress } = await import('../src/models/Progress.js');
const { default: User } = await import('../src/models/User.js');
const { PdfPage, fitSize, textWidth, toWinAnsi } = await import('../src/utils/pdf.js');
const { renderCertificate } = await import('../src/utils/certificatePdf.js');
const { CODE_PATTERN, makeCertificateCode, normalizeCode } = await import('../src/utils/certificateCode.js');

const OID = (n) => String(n).padStart(24, '0');
const STUDENT = jwt.sign({ sub: OID(1), role: 'student' }, process.env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
const CODE = 'LH-7K3M-9QXA-4TPW';

// ---------- PDF aur code ----------

test('codes look like LH-XXXX-XXXX-XXXX, never use look-alike letters, and are not repeated', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const code = makeCertificateCode();
    assert.match(code, CODE_PATTERN);
    assert.ok(!/[01OIL]/.test(code.slice(3)), `no look-alikes: ${code}`);
    seen.add(code);
  }
  assert.equal(seen.size, 2000);
  assert.equal(normalizeCode('  lh-7k3m-9qxa-4tpw '), CODE);
  for (const bad of ['', null, 'LH-7K3M-9QXA', 'LH-7K3M-9QXA-4TPW-X', 'XX-7K3M-9QXA-4TPW', 'LH-0000-1111-OOOO']) assert.equal(normalizeCode(bad), null, String(bad));
});

test('text helpers: widths follow the font, odd characters are made safe', () => {
  assert.equal(textWidth('A', 'Helvetica', 1000), 667);
  assert.equal(textWidth('i', 'Helvetica', 1000), 222);
  assert.ok(textWidth('Hello', 'Helvetica-Bold', 12) > textWidth('Hello', 'Helvetica', 12));
  assert.equal(textWidth('ab', 'Helvetica', 10, 2), (556 + 556) / 100 + 2, 'letter spacing is added between letters');
  assert.equal(toWinAnsi('  Ali\nHassan\t Khan  '), 'Ali Hassan Khan', 'line breaks and extra spaces are removed');
  assert.equal(toWinAnsi('José'), 'José', 'Latin accents stay');
  assert.equal(toWinAnsi('علی'), '???', 'letters a standard font cannot draw become ?');
  assert.throws(() => textWidth('x', 'Comic-Sans', 12));
  const size = fitSize('M'.repeat(40), 'Times-Bold', 46, 500);
  assert.ok(size < 46 && textWidth('M'.repeat(40), 'Times-Bold', size) <= 500 || size === 14);
  assert.equal(fitSize('Ali', 'Times-Bold', 46, 500), 46, 'short names keep the full size');
});

test('the PDF is well formed: header, one page, and every xref offset points at its object', () => {
  const file = renderCertificate({ studentName: 'Alishba Noor', languageName: 'HTML', issuedAt: new Date('2026-11-20T10:00:00Z'), code: CODE, verifyUrl: `https://x.example/verify/${CODE}`, lessonCount: 8 });
  const text = file.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  assert.match(text, /\/Type \/Page \/Parent 2 0 R \/MediaBox \[0 0 841\.89 595\.28\]/);
  const start = Number(text.match(/startxref\n(\d+)\n/)[1]);
  assert.ok(text.slice(start).startsWith('xref'), 'startxref points at the table');
  const entries = [...text.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.ok(entries.length >= 8);
  entries.forEach((offset, i) => assert.ok(text.slice(offset).startsWith(`${i + 1} 0 obj`), `object ${i + 1} sits at its offset`));
  const length = Number(text.match(/<< \/Length (\d+) >>\nstream/)[1]);
  const streamStart = text.indexOf('stream\n') + 'stream\n'.length;
  assert.equal(text.slice(streamStart + length, streamStart + length + 10), '\nendstream', 'stream length is exact');
});

test('the certificate shows the name, course, date, code and verify link', () => {
  const text = renderCertificate({ studentName: 'Alishba Noor', languageName: 'C++', issuedAt: new Date('2026-01-05T10:00:00Z'), code: CODE, verifyUrl: `https://x.example/verify/${CODE}`, lessonCount: 12 }).toString('latin1');
  for (const expected of ['(Alishba Noor) Tj', 'C++ Course', '5 January 2026', `(${CODE}) Tj`, `Verify at https://x.example/verify/${CODE}`, 'all 12 lessons']) {
    assert.ok(text.includes(expected), `has ${expected}`);
  }
});

test('names with brackets or backslashes cannot break the PDF; non-Latin names do not crash', () => {
  const make = (studentName) => renderCertificate({ studentName, languageName: 'CSS', issuedAt: new Date(), code: CODE, verifyUrl: 'https://x.example/v' }).toString('latin1');
  assert.ok(make('A) Tj ET (B').includes('(A\\) Tj ET \\(B) Tj'), 'brackets are escaped');
  assert.ok(make('back\\slash').includes('(back\\\\slash) Tj'));
  assert.ok(make('علی حسن').includes('(??? ???) Tj'));
  assert.ok(make('').length > 500, 'an empty name still gives a valid file');
});

test('the shapes helper draws paths, and an unknown font is refused', () => {
  const page = new PdfPage(100, 100);
  page.path([[0, 0], [50, 0], [50, 50]], { fill: '#ff0000' });
  page.path([[0, 0], [50, 50]], { stroke: '#00ff00', closed: false });
  const text = page.toBuffer().toString('latin1');
  assert.match(text, /1 0 0 rg 0 0 m 50 0 l 50 50 l h f/);
  assert.match(text, /0 1 0 RG 1 w 1 j 0 0 m 50 50 l S/);
});

// ---------- Raaste ----------

let server;
let base;
let created;
let existing;
let findOneFilter;

before(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const chain = (result) => {
  const c = { sort: () => c, select: () => c, lean: async () => result };
  return () => c;
};

async function call(method, path, { as } = {}) {
  const headers = as ? { Authorization: `Bearer ${as}` } : {};
  const res = await fetch(base + path, { method, headers });
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type') ?? '';
  return { status: res.status, headers: res.headers, buf, data: type.includes('json') ? JSON.parse(buf.toString()) : null };
}

const cert = (over = {}) => ({ user: OID(1), languageSlug: 'html', languageName: 'HTML', studentName: 'Alishba Noor', code: CODE, lessonCount: 3, issuedAt: new Date('2026-11-20T10:00:00Z'), revoked: false, ...over });

beforeEach(() => {
  mock.restoreAll();
  created = undefined;
  existing = null;
  findOneFilter = undefined;
  mock.method(Language, 'findOne', (f) => ({ select: () => ({ lean: async () => (f.slug === 'html' ? { name: 'HTML' } : null) }) }));
  mock.method(Topic, 'find', chain([{ slug: 'intro' }, { slug: 'tags' }, { slug: 'forms' }]));
  mock.method(Progress, 'findOne', () => ({ select: () => ({ lean: async () => ({ completed: ['intro', 'tags', 'forms', 'retired-topic'] }) }) }));
  mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ name: 'Alishba Noor' }) }) }));
  mock.method(Certificate, 'findOne', (f) => {
    findOneFilter = f;
    return { lean: async () => (f.code ? (f.code === CODE ? cert() : null) : existing) };
  });
  mock.method(Certificate, 'create', async (doc) => {
    created = doc;
    return { toObject: () => ({ ...doc, issuedAt: new Date('2026-11-20T10:00:00Z') }) };
  });
  mock.method(Certificate, 'find', chain([cert(), cert({ code: 'LH-AAAA-BBBB-CCCC', languageSlug: 'css', languageName: 'CSS', revoked: true })]));
});

test('issuing needs a login and a real language', async () => {
  assert.equal((await call('POST', '/api/certificates/html')).status, 401);
  assert.equal((await call('POST', '/api/certificates/nope', { as: STUDENT })).status, 404);
  assert.equal((await call('POST', '/api/certificates/Bad_Slug!', { as: STUDENT })).status, 404);
  assert.equal(created, undefined);
});

test('a finished language earns one certificate with a fresh code and the student name', async () => {
  const r = await call('POST', '/api/certificates/html', { as: STUDENT });
  assert.equal(r.status, 201);
  assert.equal(r.data.created, true);
  assert.match(created.code, CODE_PATTERN);
  assert.deepEqual([created.user, created.languageSlug, created.languageName, created.studentName, created.lessonCount], [OID(1), 'html', 'HTML', 'Alishba Noor', 3]);
  assert.deepEqual(Object.keys(r.data.certificate).sort(), ['code', 'issuedAt', 'languageName', 'languageSlug', 'revoked']);
});

test('an unfinished language is refused and says how far the student has got', async () => {
  mock.method(Progress, 'findOne', () => ({ select: () => ({ lean: async () => ({ completed: ['intro', 'tags', 'something-else'] }) }) }));
  const r = await call('POST', '/api/certificates/html', { as: STUDENT });
  assert.equal(r.status, 403);
  assert.match(r.data.message, /Finish every lesson in HTML first \(2 of 3 done\)/);
  assert.deepEqual([r.data.completed, r.data.total], [2, 3]);
  mock.method(Progress, 'findOne', () => ({ select: () => ({ lean: async () => null }) }));
  assert.equal((await call('POST', '/api/certificates/html', { as: STUDENT })).status, 403, 'no progress at all');
  mock.method(Topic, 'find', chain([]));
  assert.equal((await call('POST', '/api/certificates/html', { as: STUDENT })).status, 403, 'a language with no lessons gives nothing');
  assert.equal(created, undefined);
});

test('asking again returns the same certificate and makes no new one', async () => {
  existing = cert();
  const r = await call('POST', '/api/certificates/html', { as: STUDENT });
  assert.equal(r.status, 200);
  assert.equal(r.data.created, false);
  assert.equal(r.data.certificate.code, CODE);
  assert.equal(created, undefined);
});

test('two taps at once: the loser of the race gets the winner certificate', async () => {
  let calls = 0;
  mock.method(Certificate, 'findOne', () => ({ lean: async () => (calls++ === 0 ? null : cert()) })); // pehli dafa kuch nahi, race ke baad mil jata hai
  mock.method(Certificate, 'create', async () => {
    throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
  });
  const r = await call('POST', '/api/certificates/html', { as: STUDENT });
  assert.equal(r.status, 200);
  assert.equal(r.data.certificate.code, CODE);
});

test('a code clash makes a new code and tries again; other errors are not hidden', async () => {
  let tries = 0;
  const codes = [];
  mock.method(Certificate, 'create', async (doc) => {
    codes.push(doc.code);
    if (++tries < 3) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    return { toObject: () => ({ ...doc, issuedAt: new Date() }) };
  });
  const r = await call('POST', '/api/certificates/html', { as: STUDENT });
  assert.equal(r.status, 201);
  assert.equal(new Set(codes).size, 3, 'each try uses a new code');

  mock.method(Certificate, 'create', async () => {
    throw new Error('db down');
  });
  mock.method(console, 'error', () => {});
  assert.equal((await call('POST', '/api/certificates/html', { as: STUDENT })).status, 500);
});

test('my certificates: login needed, and the list never exposes other people', async () => {
  assert.equal((await call('GET', '/api/certificates')).status, 401);
  const r = await call('GET', '/api/certificates', { as: STUDENT });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.certificates.map((c) => [c.languageSlug, c.revoked]), [['html', false], ['css', true]]);
  assert.ok(!JSON.stringify(r.data).includes('studentName') && !JSON.stringify(r.data).includes(OID(1)));
});

test('verify is public and shows only name, course and date', async () => {
  const r = await call('GET', `/api/certificates/verify/${CODE.toLowerCase()}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { valid: true, code: CODE, studentName: 'Alishba Noor', languageName: 'HTML', lessonCount: 3, issuedAt: '2026-11-20T10:00:00.000Z' });
  assert.equal(findOneFilter.code, CODE, 'the code is looked up in capitals');
});

test('verify: unknown or badly shaped codes are "not found", a revoked one says so without details', async () => {
  const unknown = await call('GET', '/api/certificates/verify/LH-ZZZZ-ZZZZ-ZZZZ');
  assert.deepEqual([unknown.status, unknown.data.valid], [404, false]);
  assert.equal((await call('GET', '/api/certificates/verify/hello')).status, 404);
  mock.method(Certificate, 'findOne', () => ({ lean: async () => cert({ revoked: true }) }));
  const revoked = await call('GET', `/api/certificates/verify/${CODE}`);
  assert.deepEqual(revoked.data, { valid: false, revoked: true, message: 'This certificate has been revoked' });
});

test('the PDF can be opened by anyone with the code, and carries the right verify link', async () => {
  const r = await call('GET', `/api/certificates/${CODE}/pdf`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.match(r.headers.get('content-disposition'), /^inline; filename="Learning-Hub-html-certificate\.pdf"$/);
  assert.equal(r.headers.get('cache-control'), 'no-cache');
  assert.equal(Number(r.headers.get('content-length')), r.buf.length);
  const text = r.buf.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.includes('(Alishba Noor) Tj'));
  assert.ok(text.includes(`Verify at https://learning-hub.example/verify/${CODE}`), 'no double slash from the site address');
});

test('a revoked or unknown certificate gives no PDF', async () => {
  assert.equal((await call('GET', '/api/certificates/LH-ZZZZ-ZZZZ-ZZZZ/pdf')).status, 404);
  assert.equal((await call('GET', '/api/certificates/bad-code/pdf')).status, 404);
  mock.method(Certificate, 'findOne', () => ({ lean: async () => cert({ revoked: true }) }));
  assert.equal((await call('GET', `/api/certificates/${CODE}/pdf`)).status, 404);
});
