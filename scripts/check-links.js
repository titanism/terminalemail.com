'use strict';

// Checks every link and fragment between pages of the built site (_site/), and that every page
// the sitemap lists exists. External links are not fetched. Run after `npm run build`.

const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./lib');

const OUT = path.join(ROOT, '_site');
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const files = fs.readdirSync(OUT, { recursive: true }).map(String).filter((f) => f.endsWith('.html'));
const ids = new Map();
const pageFor = (file) => `/${file.replace(/index\.html$/, '').replace(/\\/g, '/')}`;

for (const f of files) {
  const html = fs.readFileSync(path.join(OUT, f), 'utf8');
  ids.set(pageFor(f), new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
}

function resolve(target) {
  const clean = target.split('#')[0].split('?')[0];
  const rel = decodeURIComponent(clean.slice(BASE.length));
  const file = path.join(OUT, rel.endsWith('/') ? `${rel}index.html` : rel);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return rel.endsWith('/') ? rel : null;
  return undefined;
}

const problems = [];
for (const f of files) {
  const html = fs.readFileSync(path.join(OUT, f), 'utf8');
  const from = pageFor(f);
  for (const [, attr, raw] of html.matchAll(/\s(href|src|srcset)="([^"]+)"/g)) {
    const urls = attr === 'srcset' ? raw.split(',').map((s) => s.trim().split(/\s+/)[0]) : [raw.replace(/&amp;/g, '&')];
    for (const href of urls) {
      if (/^(https?:|mailto:|sms:|data:)/.test(href) || href.startsWith('//')) continue;
      if (href.startsWith('#')) {
        if (href.length > 1 && !ids.get(from)?.has(href.slice(1))) problems.push(`${from}: missing #${href.slice(1)}`);
        continue;
      }
      if (!href.startsWith('/')) {
        problems.push(`${from}: relative link ${href}`);
        continue;
      }
      const page = resolve(href);
      if (page === undefined) problems.push(`${from}: broken link ${href}`);
      else if (href.includes('#') && page && !ids.get(page)?.has(href.split('#')[1])) problems.push(`${from}: missing ${href}`);
    }
  }
}

// Every sitemap URL is a page that exists.
const sitemap = fs.readFileSync(path.join(OUT, 'sitemap-en.xml'), 'utf8');
for (const [, loc] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const p = new URL(loc).pathname;
  if (!fs.existsSync(path.join(OUT, p, 'index.html'))) problems.push(`sitemap: ${loc} does not exist`);
}

if (problems.length) {
  console.error(`${problems.length} link problem${problems.length === 1 ? '' : 's'}:\n${[...new Set(problems)].slice(0, 100).map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`Links OK: ${files.length} pages checked.`);
