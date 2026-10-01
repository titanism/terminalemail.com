'use strict';

// Checks on the built site in _site/ (run `npm run build` first; `npm test` does).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const ctx = require('../scripts/context');
const T = require('../scripts/templates');
const m = require('../scripts/machine');

const OUT = path.join(__dirname, '..', '_site');
const read = (f) => fs.readFileSync(path.join(OUT, f), 'utf8');
const pages = () => fs.readdirSync(OUT, { recursive: true }).map(String).filter((f) => f.endsWith('index.html'));

test('every page has one h1, a canonical URL, a description and a social image that exists', () => {
  for (const f of pages()) {
    const html = read(f);
    assert.strictEqual((html.match(/<h1[\s>]/g) || []).length, 1, `${f}: h1 count`);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    assert.ok(canonical && canonical.startsWith(ctx.SITE_URL), `${f}: canonical`);
    const desc = html.match(/<meta name="description" content="([^"]*)">/)?.[1];
    assert.ok(desc && [...desc.replace(/&[a-z]+;|&#\d+;/g, '_')].length <= 160, `${f}: description`);
    const og = html.match(/<meta property="og:image" content="([^"]+)">/)?.[1];
    assert.ok(og, `${f}: og:image`);
    assert.ok(fs.existsSync(path.join(OUT, new URL(og).pathname)), `${f}: ${og} missing`);
    assert.match(html, /<html lang="en">/);
  }
});

test('ids are never repeated on a page', () => {
  for (const f of pages()) {
    const ids = [...read(f).matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepStrictEqual(dup, [], `${f}: repeated ids`);
  }
});

test('the sitemap lists every indexable page and no noindex page', () => {
  const listed = new Set([...read('sitemap-en.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => new URL(x[1]).pathname));
  for (const f of pages()) {
    const p = `/${f.replace(/index\.html$/, '')}`;
    const noindex = /<meta name="robots" content="noindex/.test(read(f));
    assert.strictEqual(listed.has(p), !noindex, `${p}: sitemap ${listed.has(p)}, noindex ${noindex}`);
  }
  assert.match(read('sitemap.xml'), /<loc>https:\/\/terminalemail\.com\/sitemap-en\.xml<\/loc>/);
});

test('robots.txt gives every group the content signal and points to the sitemap', () => {
  const groups = m.robots().split(/\n\s*\n/).filter((g) => /User-agent:/.test(g));
  assert.ok(groups.length >= 2);
  for (const g of groups) assert.match(g, /Content-Signal: search=yes, ai-input=yes, ai-train=yes/);
  assert.match(m.robots(), /Sitemap: https:\/\/terminalemail\.com\/sitemap\.xml/);
});

test('every page has a Markdown copy, and llms.txt links to ones that exist', () => {
  for (const f of pages()) {
    const html = read(f);
    const md = html.match(/<link rel="alternate" type="text\/markdown" href="([^"]+)"/)?.[1];
    if (md) assert.ok(fs.existsSync(path.join(OUT, md)), `${f}: ${md} missing`);
  }
  for (const [, url] of read('llms.txt').matchAll(/\]\((https:\/\/terminalemail\.com[^)]+)\)/g)) assert.ok(fs.existsSync(path.join(OUT, new URL(url).pathname)), url);
});

test('the search index only points at pages that exist on this site', () => {
  for (const x of JSON.parse(read('api/search.json'))) {
    assert.match(x.u, /^\/[a-z0-9/-]*$/, x.u);
    assert.ok(fs.existsSync(path.join(OUT, x.u, 'index.html')), x.u);
  }
});

test('the JSON API has every client, with one file per client', () => {
  const all = JSON.parse(read('api/clients.json'));
  assert.strictEqual(all.clients.length, ctx.entries.length);
  for (const e of ctx.entries) assert.strictEqual(JSON.parse(read(`api/clients/${e.slug}.json`)).name, e.name);
});

test('the home page lists every client and tool, and filters by system', () => {
  const html = read('index.html');
  for (const e of ctx.entries) assert.ok(html.includes(`href="${e.path}"`), e.slug);
  for (const s of ctx.systems) assert.ok(html.includes(`data-os-chip="${s.id}"`), s.id);
  for (const [, systems] of html.matchAll(/<tr data-os="([^"]*)" data-name="[^"]*"/g)) assert.ok(systems.split(' ').every((o) => ctx.systems.some((s) => s.id === o)), systems);
});

test('there is one comparison for every pair of clients, and each client links to its comparisons', () => {
  const n = ctx.clients.length;
  assert.strictEqual(ctx.comparisons.length, (n * (n - 1)) / 2);
  for (const c of ctx.comparisons) assert.ok(c.a.slug < c.b.slug, c.slug);
});

test('every client has a Forward Email config that uses Forward Email servers', () => {
  for (const e of ctx.clients.filter((c) => !c.featured)) assert.match(e.forward_email, /forwardemail\.net/, e.slug);
  for (const e of ctx.entries.filter((c) => !c.featured && /\bSent\b/.test(c.forward_email))) assert.ok(!/["'+/=]\s*Sent["'\n]/.test(e.forward_email), `${e.slug}: Forward Email's sent folder is "Sent Mail"`);
});

test('screenshots exist in both themes and both sizes', () => {
  for (const e of ctx.entries.filter((x) => x.screenshots)) {
    for (const s of e.screenshots) for (const theme of ['dark', 'light']) for (const size of ['', '-720']) assert.ok(fs.existsSync(path.join(OUT, 'screenshots', e.slug, `${theme}-${s.name}${size}.webp`)), `${e.slug} ${theme}-${s.name}${size}`);
  }
});

test('descriptions are cut at a sentence or word, with an ellipsis only when shortened', () => {
  assert.strictEqual(T.clip('Short.', 160), 'Short.');
  const long = 'One sentence that goes on for a while. '.repeat(10);
  const cut = T.clip(long, 160);
  assert.ok([...cut].length <= 160);
  assert.ok(cut.endsWith('.'));
  const words = T.clip('word '.repeat(60), 50);
  assert.ok(words.endsWith('…') && [...words].length <= 50);
});

test('the support sentence names every system', () => {
  const s = T.supportSentence(ctx.bySlug.get('neomutt'));
  assert.match(s, /Linux/);
  assert.match(s, /WSL/);
  assert.match(s, /Termux/);
});

test('offline and 404 pages have no share popover and are not indexed', () => {
  for (const f of ['offline/index.html', '404.html']) {
    const html = read(f);
    assert.ok(!html.includes('id="share"'), f);
    assert.match(html, /noindex/);
  }
});
