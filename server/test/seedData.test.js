import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '../src/seed/data');
const clientPublic = path.join(process.cwd(), '../client/public'); // npm test server folder se chalta hai
const expected = { html: 8, css: 12, javascript: 16, cpp: 20, python: 9, java: 9, sql: 8 };

const languages = fs
  .readdirSync(dataDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')));

test('all languages are present with the right number of topics', () => {
  assert.deepEqual(
    Object.fromEntries(languages.map((l) => [l.slug, l.topics.length])),
    expected
  );
});

test('topics have unique slugs and orders 1..n', () => {
  for (const l of languages) {
    assert.equal(new Set(l.topics.map((t) => t.slug)).size, l.topics.length, `${l.slug}: duplicate slug`);
    assert.deepEqual(l.topics.map((t) => t.order), l.topics.map((_, i) => i + 1), `${l.slug}: order`);
  }
});

test('every block is valid and html blocks are free of scripts, handlers and Blade leftovers', () => {
  for (const l of languages) {
    for (const t of l.topics) {
      assert.ok(t.title && t.blocks.length > 0, `${l.slug}/${t.slug}: empty`);
      for (const b of t.blocks) {
        assert.ok(['html', 'demo', 'playground'].includes(b.kind));
        if (b.kind === 'html') {
          assert.ok(b.html.trim(), `${l.slug}/${t.slug}: blank html block`);
          assert.ok(!/<script/i.test(b.html), `${l.slug}/${t.slug}: <script>`);
          assert.ok(!/<[^>]+\son\w+=/i.test(b.html), `${l.slug}/${t.slug}: inline handler`);
          assert.ok(!/\{\{|@section|@extends|route\(/.test(b.html), `${l.slug}/${t.slug}: Blade leftover`);
          assert.ok(!/<style/i.test(b.html), `${l.slug}/${t.slug}: <style> in html`);
        } else {
          assert.ok(b.code && b.code.trim(), `${l.slug}/${t.slug}: ${b.kind} without code`);
        }
        if (b.kind === 'demo') assert.ok(b.output && b.output.trim(), `${l.slug}/${t.slug}: demo without output`);
      }
    }
  }
});

test('every lesson image exists in client/public (when the client folder is present)', { skip: !fs.existsSync(clientPublic) }, () => {
  const missing = new Set();
  for (const l of languages)
    for (const t of l.topics)
      for (const b of t.blocks)
        if (b.kind === 'html')
          for (const m of b.html.matchAll(/src="(\/images\/[^"]+)"/g))
            if (!fs.existsSync(path.join(clientPublic, m[1]))) missing.add(m[1]);
  assert.deepEqual([...missing], []);
});

test('every topic belongs to a section and each section is one unbroken group in the sidebar', () => {
  for (const l of languages) {
    const seen = new Set();
    let previous = null;
    for (const t of l.topics) {
      assert.ok(t.section && t.section.trim(), `${l.slug}/${t.slug}: no section`);
      if (t.section !== previous) {
        assert.ok(!seen.has(t.section), `${l.slug}: section "${t.section}" is split into two groups`);
        seen.add(t.section);
        previous = t.section;
      }
    }
    assert.ok(seen.size >= 3, `${l.slug}: expected at least 3 sections`);
  }
});

test('the new lessons exist and have real content', () => {
  const must = {
    html: ['attributes', 'forms-validation', 'accessibility-seo'],
    css: ['flexbox', 'grid', 'transitions-animations', 'variables-units'],
    javascript: ['objects-json', 'scope-closures', 'es6-essentials', 'error-handling', 'web-storage'],
    cpp: ['strings', 'structs-enums', 'operator-overloading', 'exceptions', 'templates', 'stl-basics', 'file-handling'],
    python: ['intro', 'loops', 'oop', 'errors-files'],
    java: ['intro', 'arrays-strings', 'inheritance-interfaces', 'exceptions-collections'],
    sql: ['intro', 'joins', 'subqueries', 'keys-constraints'],
  };
  for (const l of languages) {
    for (const slug of must[l.slug]) {
      const t = l.topics.find((x) => x.slug === slug);
      assert.ok(t, `${l.slug}/${slug} missing`);
      const text = t.blocks.map((b) => b.html || b.code).join(' ');
      assert.ok(text.length > 1200, `${l.slug}/${slug} is too short`);
    }
  }
});

test('the language cards in the client match the seeded languages (when the client folder is present)', { skip: !fs.existsSync(path.join(process.cwd(), '../client/src/data/languages.js')) }, async () => {
  const { languages: cards } = await import(pathToFileURL(path.join(process.cwd(), '../client/src/data/languages.js')).href);
  assert.deepEqual(cards.map((c) => c.slug).sort(), languages.map((l) => l.slug).sort());
  for (const card of cards) {
    const lang = languages.find((l) => l.slug === card.slug);
    assert.equal(card.name, lang.name, `${card.slug}: name`);
    assert.equal(card.color, lang.color, `${card.slug}: colour`);
    assert.ok(fs.existsSync(path.join(process.cwd(), '../client/public', card.image)), `${card.slug}: image ${card.image} is missing`);
  }
});
