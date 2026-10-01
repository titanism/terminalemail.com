'use strict';

// Builds the whole site into _site/: HTML pages, Markdown copies, JSON API, llms.txt,
// sitemap, robots.txt, feed, social images and the service worker. Run with `npm run build`.

const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./lib');
const ctx = require('./context');
const T = require('./templates');
const P = require('./pages');
const m = require('./machine');
const og = require('./og');

const OUT = path.join(ROOT, '_site');
const { entries, clients, tools, systems, comparisons, alternatives, features, pages, DOCS, site, BASE, SITE_URL, newest, lastmod } = ctx;
const sitemapUrls = [];

// Paths come from data files (slugs), so every write is checked to stay inside _site/.
function write(file, content) {
  const full = path.resolve(OUT, file);
  if (!full.startsWith(OUT + path.sep)) throw new Error(`Refusing to write outside _site/: ${file}`);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// Page paths are lowercase kebab-case segments. Two pages with the same path would silently
// overwrite each other, so that fails the build.
const PAGE_PATH = /^\/([a-z0-9]+(-[a-z0-9]+)*\/)*$/;
const written = new Set();
function page(p, html, markdown, { index = true, lastmod: lm = null } = {}) {
  if (!PAGE_PATH.test(p)) throw new Error(`Invalid page path ${JSON.stringify(p)}`);
  if (written.has(p)) throw new Error(`Two pages share the path ${p}`);
  written.add(p);
  const dir = p === '/' ? '' : p.replace(/^\//, '');
  write(path.join(dir, 'index.html'), html);
  if (markdown) write(path.join(dir, 'index.md'), markdown);
  if (index) sitemapUrls.push({ path: p, lastmod: lm ? lm.slice(0, 10) : null });
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'site'), OUT, { recursive: true });
// Minify the one script and stylesheet. The sources in site/ stay readable.
{
  const esbuild = require('esbuild');
  for (const [file, loader] of [['app.js', 'js'], ['style.css', 'css']]) {
    const src = fs.readFileSync(path.join(ROOT, 'site', file), 'utf8');
    fs.writeFileSync(path.join(OUT, file), esbuild.transformSync(src, { loader, minify: true, target: loader === 'js' ? 'es2017' : ['chrome100', 'firefox100', 'safari15'], legalComments: 'none' }).code);
  }
}

// Pages
page('/', P.homePage(), m.homeMd(), { lastmod: newest(entries) });
page('/clients/', P.clientsIndex(), m.indexMd('Terminal email clients', `All ${clients.length} clients.`, clients), { lastmod: newest(clients) });
page('/tools/', P.toolsIndex(), m.indexMd('Mail tools', 'Programs that sync, send, fetch or index mail for terminal clients.', tools), { lastmod: newest(tools) });
for (const e of entries) {
  page(e.path, P.entryPage(e), m.entryMd(e), { lastmod: e.lastmod });
  write(`api/clients/${e.slug}.json`, JSON.stringify(m.entryJson(e), null, 2));
}
page('/systems/', P.systemsIndex(), m.systemsIndexMd(), { lastmod: newest(entries) });
for (const s of systems) page(s.path, P.systemPage(s), m.systemMd(s), { lastmod: newest(s.clients) });
page('/compare/', P.compareIndex(), m.compareIndexMd(), { lastmod: newest(clients) });
for (const c of comparisons) page(c.path, P.comparePage(c), m.compareMd(c), { lastmod: newest([c.a, c.b]) });
page('/alternatives/', P.alternativesIndex(), m.alternativesIndexMd(), { lastmod: newest(clients) });
for (const a of alternatives) page(a.path, P.alternativesPage(a), m.alternativesMd(a), { lastmod: newest([a.entry, ...a.list.slice(0, 10)]) });
page('/features/', P.featuresIndex(), m.featuresIndexMd(), { lastmod: newest(clients) });
for (const f of features) page(f.path, P.featurePage(f), m.featureMd(f), { lastmod: newest(f.list) });
page('/setup/', P.setupPage(), m.setupMd(), { lastmod: newest(entries) });
for (const d of [...pages, ...DOCS]) page(d.path, P.docPage(d), d.body, { lastmod: lastmod(d.file) });
page('/search/', P.searchPage(), null, { index: false });
page('/offline/', P.offlinePage(), null, { index: false });
write('404.html', P.notFound());

// Machine-readable files
write('index.md', m.homeMd());
write('llms.txt', m.llmsTxt());
write('llms-full.txt', m.llmsFullTxt());
write('api/clients.json', JSON.stringify(m.clientsJson(), null, 2));
write('api/search.json', JSON.stringify(m.searchJson()));
write('robots.txt', m.robots());
write('feed.xml', m.feed());
write('site.webmanifest', m.manifest());
write('sw.js', m.serviceWorker());
write('.nojekyll', '');
// Custom domain: the CNAME file at the repository root (kept in sync with site.yml's url).
if (!BASE) {
  const cname = fs.existsSync(path.join(ROOT, 'CNAME')) ? fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim() : site.url && new URL(site.url).hostname;
  if (site.url && cname !== new URL(site.url).hostname) throw new Error(`CNAME (${cname}) does not match the url in site.yml`);
  if (cname) write('CNAME', `${cname}\n`);
}
write('sitemap-en.xml', m.sitemap(sitemapUrls));
write('sitemap.xml', m.sitemapIndex([{ file: 'sitemap-en.xml', lastmod: sitemapUrls.map((x) => x.lastmod).filter(Boolean).sort().pop() || null }]));

// Social images, one per page, then the site-wide default (the home page image).
og.renderAll(T.ogJobs, OUT)
  .then(({ total, rendered }) => {
    fs.copyFileSync(path.join(OUT, 'og', 'home.png'), path.join(OUT, 'og.png'));
    console.log(`Social images: ${total} (${rendered} newly rendered, the rest from .cache/og)`);
  })
  .catch((err) => {
    console.error('Social images failed:', err);
    process.exitCode = 1;
  });

const count = (dir) => fs.readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('index.html')).length;
console.log(`Built ${count(OUT)} pages (${sitemapUrls.length} in the sitemap) for ${clients.length} clients and ${tools.length} tools: ${comparisons.length} comparisons, ${alternatives.length} alternatives pages, ${features.length} feature lists, ${systems.length} systems. Site URL: ${SITE_URL}`);
