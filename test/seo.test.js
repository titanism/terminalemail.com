'use strict';

// Search and AI-crawler checks on the built site in _site/ (run `npm run build` first; `npm test`
// does): metadata on every page, structured data that matches what the page shows, the guide
// pages, robots.txt, llms.txt and security.txt.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const ctx = require('../scripts/context');
const G = require('../scripts/guides');

const OUT = path.join(__dirname, '..', '_site');
const read = (f) => fs.readFileSync(path.join(OUT, f), 'utf8');
const pages = () => fs.readdirSync(OUT, { recursive: true }).map(String).filter((f) => f.endsWith('index.html'));
const indexable = () => pages().filter((f) => !/<meta name="robots" content="noindex/.test(read(f)));
const meta = (html, attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)">`))?.[1];
const decode = (s) => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (html) => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const graph = (html) => {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1])['@graph'] : null;
};
const urlOf = (f) => `${ctx.SITE_URL}/${f.replace(/index\.html$/, '')}`;
const GUIDE_PAGES = ['/best/', '/faq/', '/glossary/', '/privacy/', '/terms/'];

test('every indexable page has matching canonical, Open Graph and Twitter tags', () => {
  for (const f of indexable()) {
    const html = read(f);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    assert.strictEqual(canonical, urlOf(f), `${f}: canonical`);
    assert.strictEqual(meta(html, 'property', 'og:url'), canonical, `${f}: og:url`);
    for (const p of ['og:title', 'og:description', 'og:image', 'og:image:alt', 'og:type', 'og:site_name']) assert.ok(meta(html, 'property', p), `${f}: ${p}`);
    assert.strictEqual(meta(html, 'property', 'og:image:width'), '1200', `${f}: og:image:width`);
    assert.strictEqual(meta(html, 'property', 'og:image:height'), '630', `${f}: og:image:height`);
    assert.strictEqual(meta(html, 'name', 'twitter:card'), 'summary_large_image', `${f}: twitter:card`);
  }
});

test('titles are unique and fit in a search result', () => {
  const seen = new Map();
  for (const f of indexable()) {
    const title = decode(read(f).match(/<title>([^<]*)<\/title>/)?.[1] || '');
    assert.ok([...title].length >= 20 && [...title].length <= 70, `${f}: title "${title}" is ${[...title].length} characters`);
    assert.ok(!seen.has(title), `${f}: same title as ${seen.get(title)}`);
    seen.set(title, f);
  }
});

test('every indexable page has Organization, WebSite and, below the home page, breadcrumbs', () => {
  for (const f of indexable()) {
    const nodes = graph(read(f));
    assert.ok(nodes, `${f}: no JSON-LD`);
    const types = nodes.map((n) => n['@type']);
    assert.ok(types.includes('Organization') && types.includes('WebSite'), `${f}: ${types}`);
    if (f !== 'index.html') {
      const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList');
      assert.ok(crumbs, `${f}: no BreadcrumbList`);
      assert.strictEqual(crumbs.itemListElement.at(-1).item, urlOf(f), `${f}: last breadcrumb is not the page`);
    }
  }
});

test('noindex pages carry no structured data', () => {
  for (const f of pages().filter((x) => !indexable().includes(x))) assert.strictEqual(graph(read(f)), null, f);
  assert.strictEqual(graph(read('404.html')), null, '404.html');
});

test('FAQPage structured data repeats exactly the questions the page shows', () => {
  let checked = 0;
  for (const f of indexable()) {
    const html = read(f);
    const faq = graph(html).find((n) => n['@type'] === 'FAQPage');
    if (!faq) continue;
    checked++;
    const shown = f === 'faq/index.html' ? [...html.matchAll(/<section aria-labelledby="[^"]+"><h2 id="[^"]+">([^<]+)<\/h2>/g)].map((m) => decode(m[1])) : [...html.matchAll(/<summary><h3>([^<]+)<\/h3><\/summary>/g)].map((m) => decode(m[1]));
    assert.deepStrictEqual(faq.mainEntity.map((q) => q.name), shown, f);
    for (const q of faq.mainEntity) assert.ok(text(html).includes(q.acceptedAnswer.text.replace(/\s+/g, ' ').slice(0, 60)), `${f}: answer to "${q.name}" is not on the page`);
  }
  assert.ok(checked > ctx.entries.length, `only ${checked} pages with FAQPage`);
});

test('the guide pages exist, are linked from every page, and are listed in the sitemap, llms.txt and search', () => {
  const sitemap = read('sitemap-en.xml');
  const llms = read('llms.txt');
  const search = JSON.parse(read('api/search.json')).map((x) => x.u);
  const footer = read('clients/neomutt/index.html');
  for (const p of GUIDE_PAGES) {
    const html = read(`${p.slice(1)}index.html`);
    assert.strictEqual((html.match(/<h1[\s>]/g) || []).length, 1, p);
    assert.ok(text(html.match(/<main[\s\S]*<\/main>/)[0]).split(' ').length > 300, `${p}: under 300 words`);
    assert.ok(fs.existsSync(path.join(OUT, p, 'index.md')), `${p}: no Markdown copy`);
    assert.ok(sitemap.includes(`<loc>${ctx.SITE_URL}${p}</loc>`), `${p}: not in the sitemap`);
    assert.ok(llms.includes(`${ctx.SITE_URL}${p}index.md`), `${p}: not in llms.txt`);
    assert.ok(search.includes(p), `${p}: not in the search index`);
    assert.ok(footer.includes(`href="${p}"`), `${p}: not linked from the footer`);
  }
  for (const g of G.GUIDES) assert.ok(read('llms-full.txt').includes(g.md().split('\n')[0]), `${g.path}: not in llms-full.txt`);
});

test('the best-clients page names each pick, links to it, and lists it in structured data', () => {
  const html = read('best/index.html');
  const list = graph(html).find((n) => n['@type'] === 'WebPage').mainEntity.itemListElement.map((x) => x.url);
  for (const p of G.picks) {
    assert.ok(html.includes(`<h2 id="${p.id}">`), p.id);
    if (!p.e) continue;
    assert.ok(html.includes(`href="${p.e.path}"`), `${p.id}: no link to ${p.e.path}`);
    assert.ok(list.includes(`${ctx.SITE_URL}${p.e.path}`), `${p.id}: not in the ItemList`);
  }
  // Forward Email made the site, so its pick says so on the page.
  assert.match(text(html), /made by the team behind this site/);
});

test('the glossary defines each term once, in the page and in DefinedTermSet', () => {
  const html = read('glossary/index.html');
  const shown = [...html.matchAll(/<dt id="([^"]+)">([^<]+)<\/dt>/g)];
  const set = graph(html).find((n) => n['@type'] === 'DefinedTermSet');
  assert.strictEqual(set.hasDefinedTerm.length, shown.length);
  assert.strictEqual(new Set(shown.map((m) => m[1])).size, shown.length, 'repeated term ids');
  for (const [i, term] of set.hasDefinedTerm.entries()) {
    assert.strictEqual(term.name, decode(shown[i][2]));
    assert.strictEqual(term.url, `${ctx.SITE_URL}/glossary/#${shown[i][1]}`);
    assert.ok(term.description.length > 20, term.name);
  }
  for (const [, n] of html.matchAll(/href="https:\/\/www\.rfc-editor\.org\/rfc\/rfc(\d+)\.html"/g)) assert.match(n, /^\d{4}$/);
});

test('robots.txt names the AI crawlers and allows everything', () => {
  const robots = read('robots.txt');
  for (const bot of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bingbot', 'DuckAssistBot', 'Meta-ExternalAgent']) assert.match(robots, new RegExp(`^User-agent: ${bot}$`, 'm'), bot);
  assert.ok(!/^Disallow:\s*\S/m.test(robots), 'robots.txt disallows a path');
});

test('security.txt has the contacts from SECURITY.md and a valid expiry', () => {
  const txt = read('.well-known/security.txt');
  const policy = fs.readFileSync(path.join(__dirname, '..', 'SECURITY.md'), 'utf8');
  const contacts = [...txt.matchAll(/^Contact: (.+)$/gm)].map((m) => m[1]);
  assert.ok(contacts.length >= 1);
  for (const c of contacts) assert.ok(policy.includes(c.replace(/^mailto:/, '')), `${c} is not in SECURITY.md`);
  const expires = new Date(txt.match(/^Expires: (.+)$/m)[1]);
  const days = (expires - Date.now()) / 864e5;
  assert.ok(days > 300 && days <= 366, `Expires is ${days} days away`);
  assert.match(txt, /^Canonical: https:\/\/terminalemail\.com\/\.well-known\/security\.txt$/m);
});

test('share links have no recipient-less mailto: or sms: links for crawlers to follow', () => {
  for (const f of pages()) assert.ok(!/\shref="(mailto|sms):\?/.test(read(f)), f);
});

test('the first screenshot is not lazy-loaded: both themes on the home page, the dark one with high priority on a client page', () => {
  const home = [...read('index.html').matchAll(/<img class="shot[^>]*>/g)].map((m) => m[0]);
  for (const img of home.slice(0, 2)) assert.ok(!img.includes('loading="lazy"'), img);
  const entry = [...read('clients/forward-email/index.html').matchAll(/<img class="shot[^>]*>/g)].map((m) => m[0]);
  assert.match(entry[0], /class="shot shot-dark"[^>]*fetchpriority="high"/);
  for (const img of [...home.slice(2), ...entry.slice(2)]) assert.ok(img.includes('loading="lazy"'), img);
});
