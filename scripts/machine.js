'use strict';

// Machine-readable output: a Markdown copy of each page, llms.txt, JSON, the search index,
// sitemaps, robots.txt, the Atom feed, the web app manifest and the service worker.

const { execFileSync } = require('node:child_process');
const ctx = require('./context');
const lib = require('./lib');
const P = require('./pages');
const { licenseText, supportSentence, joinList, osName, cellText } = require('./templates');

const { site, SITE_URL, REPO, NOW, entries, clients, tools, featured, systems, comparisons, alternatives, features, pages, DOCS, FE_SETTINGS } = ctx;
const { OSES, SUPPORT, INTERFACES, TYPES, PROTOCOLS, FEATURES } = lib;

const abs = (p) => `${SITE_URL}${p}`;
const mdLink = (text, p) => `[${text}](${abs(p)})`;
const cellMd = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const strip = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const fence = (code) => `\`\`\`\n${String(code).replace(/\n+$/, '')}\n\`\`\``;

function listMd(list, { os = null } = {}) {
  const head = os ? `| Client | ${osName(os)} | Install |\n| --- | --- | --- |` : '| Client | Interface | Systems | License |\n| --- | --- | --- | --- |';
  const rows = list.map((e) =>
    os
      ? `| ${mdLink(e.name, `${e.path}index.md`)} | ${SUPPORT[e.platforms[os].support].label} | ${cellMd(e.platforms[os].install?.[0]?.cmd ? `\`${e.platforms[os].install[0].cmd}\`` : '')} |`
      : `| ${mdLink(e.name, `${e.path}index.md`)}${e.featured ? ' (featured)' : ''} | ${INTERFACES[e.interface].label} | ${cellMd(e.oses.map(osName).join(', '))} | ${cellMd(licenseText(e))} |`
  );
  return [head, ...rows].join('\n');
}
const faqMd = (qa) => `## Questions\n\n${qa.map(([q, a]) => `### ${q}\n\n${strip(a)}`).join('\n\n')}`;
const settingsMd = () => `| Protocol | Server | Port | Security |\n| --- | --- | --- | --- |\n${FE_SETTINGS.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n\nUsername: your full alias address. Password: the one from Generate Password next to the alias. Folders: INBOX, Drafts, Sent Mail, Trash, Spam and Archive.`;

function homeMd() {
  return `# ${site.title}

> ${site.tagline}

Read and send email from a terminal on Linux, macOS, Windows, BSD and Android. Featured: ${mdLink('Forward Email', `${featured.path}index.md`)}'s terminal app, made by the team behind this site (${featured.summary})

## Clients

${listMd(clients)}

## Mail tools

${listMd(tools)}

## By system

${systems.map((s) => `- ${mdLink(`Terminal email clients for ${s.name}`, `${s.path}index.md`)}: ${s.clients.length} clients, ${s.native.length} native`).join('\n')}

## By feature

${features.map((f) => `- ${mdLink(f.h1, `${f.path}index.md`)} (${f.list.length})`).join('\n')}

${faqMd(P.homeFaq())}
`;
}

function entryMd(e) {
  const plat = OSES.map((o) => {
    const p = e.platforms[o.id];
    return `### ${o.name}\n\n${SUPPORT[p.support].label}.${p.note ? ` ${p.note}` : ''}${p.install?.length ? `\n\n${p.install.map((s) => `- ${s.via}: \`${s.cmd}\``).join('\n')}` : ''}`;
  }).join('\n\n');
  return `# ${e.name}

> ${e.summary}

${e.description}

- Type: ${TYPES[e.type]}
- Interface: ${INTERFACES[e.interface].long}
- Systems: ${supportSentence(e)}
- Language: ${e.language}
- License: ${licenseText(e)} (${e.license})
${e.latest_version ? `- Latest version: ${e.latest_version}\n` : ''}${e.lineage ? `- Background: ${e.lineage}\n` : ''}- Maintained: ${e.maintained ? 'yes' : 'no recent commits or releases'}
${e.website ? `- Website: ${e.website}\n` : ''}${e.repo ? `- Source: ${e.repo}\n` : ''}${e.docs ? `- Documentation: ${e.docs}\n` : ''}
## Install

${plat}

## Protocols

${e.backend ? `Connects through: ${e.backend}\n\nAccounts: ${e.account.replace(/`/g, '')}` : PROTOCOLS.map(([k, n]) => `- ${n}: ${cellText(e.protocols[k])}`).join('\n')}

## Features

${FEATURES.map(([k, n]) => `- ${n}: ${cellText(e.features[k])}`).join('\n')}

## Pros

${e.pros.map((p) => `- ${p}`).join('\n')}

## Cons

${e.cons.map((p) => `- ${p}`).join('\n')}

## ${e.featured ? 'Install and run' : `Use ${e.name} with Forward Email`}

${e.forward_email_file ? `File: \`${e.forward_email_file}\`\n\n` : ''}${fence(e.forward_email)}
${e.featured ? '' : `\n${settingsMd()}\n`}
${faqMd(P.entryFaq(e))}

## Sources

${e.sources.map((s) => `- ${s}`).join('\n')}
`;
}

const systemMd = (s) => `# Terminal email clients for ${s.name}

${strip(P.OS_TEXT[s.id]())}

## Clients

${listMd(s.clients, { os: s.id })}
${s.tools.length ? `\n## Mail tools\n\n${listMd(s.tools, { os: s.id })}\n` : ''}
${faqMd(P.systemFaq(s))}
`;

function compareMd(c) {
  const { a, b } = c;
  const row = (label, x, y) => `| ${label} | ${cellMd(x)} | ${cellMd(y)} |`;
  return `# ${a.name} vs ${b.name}

- ${a.name}: ${a.summary}
- ${b.name}: ${b.summary}

## Differences

${P.differences(a, b).map((d) => `- ${strip(d)}`).join('\n') || 'They support the same protocols and systems.'}

## Side by side

| | ${a.name} | ${b.name} |
| --- | --- | --- |
${row('Interface', INTERFACES[a.interface].long, INTERFACES[b.interface].long)}
${row('Language', a.language, b.language)}
${row('License', licenseText(a), licenseText(b))}
${OSES.map((o) => row(o.name, SUPPORT[a.platforms[o.id].support].label, SUPPORT[b.platforms[o.id].support].label)).join('\n')}
${PROTOCOLS.map(([k, n]) => row(n, a.backend ? 'Forward Email API' : cellText(a.protocols[k]), b.backend ? 'Forward Email API' : cellText(b.protocols[k]))).join('\n')}
${FEATURES.map(([k, n]) => row(n, cellText(a.features[k]), cellText(b.features[k]))).join('\n')}

Pages: ${mdLink(a.name, `${a.path}index.md`)}, ${mdLink(b.name, `${b.path}index.md`)}
`;
}

const alternativesMd = (a) => `# ${a.entry.name} alternatives

Terminal email clients to use instead of ${mdLink(a.entry.name, `${a.entry.path}index.md`)}, most similar first.

${a.list.slice(0, 10).map((c, i) => `${i + 1}. ${mdLink(c.name, `${c.path}index.md`)}: ${P.why(a.entry, c)} ${c.summary}`).join('\n')}
`;

const featureMd = (f) => `# ${f.h1}

${f.intro}

${listMd(f.list)}
`;

function setupMd() {
  return `# Forward Email settings for terminal email clients

${settingsMd()}

Forward Email's own terminal app needs none of this: \`npm install -g forwardemail\`, then run \`forwardemail\` and sign in.

${entries
  .filter((e) => !e.featured)
  .map((e) => `## ${e.name}\n\n${e.forward_email_file ? `File: \`${e.forward_email_file}\`\n\n` : ''}${fence(e.forward_email)}`)
  .join('\n\n')}
`;
}

const indexMd = (title, intro, list) => `# ${title}\n\n${intro}\n\n${listMd(list)}\n`;
const compareIndexMd = () => `# Compare terminal email clients\n\n${comparisons.map((c) => `- ${mdLink(`${c.a.name} vs ${c.b.name}`, `${c.path}index.md`)}`).join('\n')}\n`;
const alternativesIndexMd = () => `# Alternatives to terminal email clients\n\n${alternatives.map((a) => `- ${mdLink(`${a.entry.name} alternatives`, `${a.path}index.md`)}`).join('\n')}\n`;
const featuresIndexMd = () => `# Terminal email clients by feature\n\n${features.map((f) => `- ${mdLink(f.h1, `${f.path}index.md`)} (${f.list.length})`).join('\n')}\n`;
const systemsIndexMd = () => `# Terminal email by system\n\n| Client | ${OSES.map((o) => o.name).join(' | ')} |\n| --- | ${OSES.map(() => '---').join(' | ')} |\n${clients.map((c) => `| ${mdLink(c.name, `${c.path}index.md`)} | ${OSES.map((o) => SUPPORT[c.platforms[o.id].support].label).join(' | ')} |`).join('\n')}\n`;

// ---------- llms.txt ----------

function llmsTxt() {
  return `# ${site.title}

> ${site.tagline} ${clients.length} terminal email clients and ${tools.length} mail tools, each with verified install commands for Linux, macOS, Windows, BSD and Android, protocol and feature support, pros and cons, a working Forward Email config and links to the sources the facts came from. Made by Forward Email, whose terminal app (\`forwardemail\`) is featured and disclosed as such.

Every page has a Markdown version at the same URL plus \`index.md\`. All data is at ${abs('/api/clients.json')} and in one text file at ${abs('/llms-full.txt')}. Content is CC BY-SA 4.0.

## Featured

- ${mdLink(`${featured.name} terminal app`, `${featured.path}index.md`)}: ${featured.summary}

## Clients

${clients.filter((c) => !c.featured).map((c) => `- ${mdLink(c.name, `${c.path}index.md`)}: ${c.summary}`).join('\n')}

## Mail tools

${tools.map((c) => `- ${mdLink(c.name, `${c.path}index.md`)}: ${c.summary}`).join('\n')}

## By system

${systems.map((s) => `- ${mdLink(`Terminal email clients for ${s.name}`, `${s.path}index.md`)}`).join('\n')}

## By feature

${features.map((f) => `- ${mdLink(f.h1, `${f.path}index.md`)}`).join('\n')}

## Other pages

- ${mdLink('Forward Email settings and configs for every client', '/setup/index.md')}
- ${mdLink('All comparisons', '/compare/index.md')} (${comparisons.length} pages such as ${mdLink('NeoMutt vs aerc', '/compare/aerc-vs-neomutt/index.md')})
- ${mdLink('Alternatives', '/alternatives/index.md')}
${pages.map((p) => `- ${mdLink(p.title, `${p.path}index.md`)}: ${p.description}`).join('\n')}

## Data

- ${mdLink('All clients and tools (JSON)', '/api/clients.json')}
- One JSON file per entry at \`/api/clients/<slug>.json\`
- ${mdLink('Sitemap', '/sitemap.xml')}
- Source repository: ${REPO}
`;
}

const llmsFullTxt = () => [llmsTxt(), setupMd(), ...entries.map(entryMd), ...systems.map(systemMd), ...pages.map((p) => p.body)].join('\n\n---\n\n');

// ---------- JSON ----------

function entryJson(e) {
  return {
    name: e.name,
    slug: e.slug,
    type: e.type,
    interface: e.interface,
    featured: Boolean(e.featured),
    url: abs(e.path),
    summary: e.summary,
    description: e.description,
    website: e.website || null,
    repo: e.repo || null,
    docs: e.docs || null,
    license: e.license,
    open_source: e.openSource,
    language: e.language,
    maintained: e.maintained,
    latest_version: e.latest_version || null,
    lineage: e.lineage || null,
    backend: e.backend || null,
    platforms: e.platforms,
    protocols: e.protocols,
    features: e.features,
    pros: e.pros,
    cons: e.cons,
    forward_email: { config: e.forward_email, file: e.forward_email_file || null },
    sources: e.sources,
    updated: e.lastmod
  };
}

const clientsJson = () => ({ name: site.title, url: `${SITE_URL}/`, license: 'CC BY-SA 4.0', generated: NOW, systems: OSES.map(({ id, name }) => ({ id, name })), clients: entries.map(entryJson) });

function searchJson() {
  const out = entries.map((e) => ({ t: e.type === 'tool' ? 't' : 'e', n: e.name, u: abs(e.path).replace(SITE_URL, ctx.BASE), d: e.summary.slice(0, 140), k: [e.slug, ...(e.aliases || []), e.language, INTERFACES[e.interface].label, ...e.oses.map(osName), ...PROTOCOLS.filter(([k]) => e.protocols[k] === true).map(([, n]) => n)].join(' '), ...(e.featured ? { f: 1 } : {}), ...(e.maintained ? {} : { x: 1 }) }));
  for (const s of systems) out.push({ t: 's', n: `Terminal email clients for ${s.name}`, u: `${ctx.BASE}${s.path}`, d: `${s.clients.length} clients, ${s.native.length} native`, k: `${s.id} ${s.name} ${s.blurb}` });
  for (const f of features) out.push({ t: 'f', n: f.h1, u: `${ctx.BASE}${f.path}`, d: f.intro, k: f.slug.replace(/-/g, ' ') });
  for (const a of alternatives) out.push({ t: 'a', n: `${a.entry.name} alternatives`, u: `${ctx.BASE}${a.path}`, d: `${a.list.length} other clients, most similar first`, k: `${a.entry.slug} instead replace` });
  for (const c of comparisons) out.push({ t: 'c', n: `${c.a.name} vs ${c.b.name}`, u: `${ctx.BASE}${c.path}`, d: 'Side by side', k: `${c.a.slug} ${c.b.slug} versus compare` });
  for (const [n, p, d] of [['Forward Email settings for terminal clients', '/setup/', 'IMAP, POP3 and SMTP settings and configs'], ['All clients', '/clients/', 'Every terminal email client'], ['Mail tools', '/tools/', 'Sync, send and index mail'], ...pages.map((x) => [x.title, x.path, x.description])]) out.push({ t: 'p', n, u: `${ctx.BASE}${p}`, d });
  return out;
}

// ---------- sitemap, robots, feed, manifest ----------

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sitemap = (urls) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ path, lastmod }) => `  <url><loc>${xml(abs(path))}</loc>${lastmod ? `<lastmod>${xml(lastmod)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;

const sitemapIndex = (files) => `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${files.map(({ file, lastmod }) => `  <sitemap><loc>${xml(abs(`/${file}`))}</loc>${lastmod ? `<lastmod>${xml(lastmod)}</lastmod>` : ''}</sitemap>`).join('\n')}
</sitemapindex>
`;

function robots() {
  const bots = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Applebot', 'Applebot-Extended', 'Google-Extended', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'CCBot', 'Meta-ExternalAgent', 'MistralAI-User', 'cohere-ai', 'Amazonbot', 'YouBot'];
  // A crawler reads only the group that names it, so every group repeats the content signal.
  const signal = 'Content-Signal: search=yes, ai-input=yes, ai-train=yes';
  return `# Terminal Email welcomes search engines and AI crawlers.
# Content is CC BY-SA 4.0. Markdown versions: add index.md to any page URL. Summary for AI: ${abs('/llms.txt')}

${bots.map((b) => `User-agent: ${b}`).join('\n')}
Allow: /
${signal}

User-agent: *
Allow: /
${signal}

Sitemap: ${abs('/sitemap.xml')}
`;
}

function feed() {
  let log = '';
  try {
    log = execFileSync('git', ['log', '-n', '60', '--format=@%H|%cI|%s', '--name-only', '--', 'clients', 'pages'], { cwd: lib.ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {}
  const items = [];
  let cur = null;
  for (const line of log.split('\n')) {
    if (line.startsWith('@')) {
      const [hash, date, ...subject] = line.slice(1).split('|');
      cur = { hash, date, subject: subject.join('|'), files: [] };
      items.push(cur);
    } else if (line && cur) cur.files.push(line);
  }
  const byFile = Object.fromEntries(entries.map((e) => [e.file, e]));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(site.title)}: changes to the list</title>
  <link href="${abs('/')}"/>
  <link rel="self" href="${abs('/feed.xml')}"/>
  <id>${abs('/')}</id>
  <author><name>${esc(site.title)}</name><uri>${abs('/')}</uri></author>
  <updated>${items[0]?.date || NOW}</updated>
${items
  .map((it) => {
    const changed = it.files.map((f) => byFile[f]).filter(Boolean);
    const link = changed.length === 1 ? abs(changed[0].path) : `${REPO}/commit/${it.hash}`;
    return `  <entry>
    <title>${esc(it.subject)}</title>
    <link href="${esc(link)}"/>
    <id>${REPO}/commit/${it.hash}</id>
    <updated>${it.date}</updated>
    <summary>${esc(changed.length ? `Updated: ${changed.map((e) => e.name).join(', ')}` : it.files.slice(0, 10).join(', '))}</summary>
  </entry>`;
  })
  .join('\n')}
</feed>
`;
}

function manifest() {
  const B = ctx.BASE;
  return JSON.stringify(
    {
      id: `${B}/`,
      name: site.title,
      short_name: site.title,
      description: site.tagline,
      lang: 'en',
      dir: 'ltr',
      start_url: `${B}/`,
      scope: `${B}/`,
      display: 'standalone',
      display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
      orientation: 'any',
      background_color: '#15110b',
      theme_color: '#15110b',
      categories: ['utilities', 'productivity', 'reference'],
      icons: [
        { src: `${B}/favicon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: `${B}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${B}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: `${B}/icon-maskable-192.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: `${B}/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ],
      screenshots: [
        { src: `${B}/screenshots/wide.png`, sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Terminal email clients by system' },
        { src: `${B}/screenshots/narrow.png`, sizes: '540x1080', type: 'image/png', form_factor: 'narrow', label: 'A client page on a phone' }
      ],
      shortcuts: [
        { name: 'Search', short_name: 'Search', url: `${B}/search/`, icons: [{ src: `${B}/icon-192.png`, sizes: '192x192' }] },
        { name: 'All clients', short_name: 'Clients', url: `${B}/clients/`, icons: [{ src: `${B}/icon-192.png`, sizes: '192x192' }] },
        { name: 'Forward Email setup', short_name: 'Setup', url: `${B}/setup/`, icons: [{ src: `${B}/icon-192.png`, sizes: '192x192' }] }
      ]
    },
    null,
    2
  );
}

// Service worker: pages are network first with an offline fallback; images and fonts are served
// from cache while being refreshed. The version changes when the CSS or JavaScript does.
function serviceWorker() {
  const fs = require('node:fs');
  const path = require('node:path');
  const hash = require('node:crypto').createHash('sha256');
  for (const f of ['style.css', 'app.js']) hash.update(fs.readFileSync(path.join(__dirname, '..', 'site', f)));
  const version = hash.digest('hex').slice(0, 10);
  return `'use strict';
// Terminal Email service worker. Generated by scripts/machine.js.
const VERSION = '${version}';
const SHELL = 'shell-' + VERSION;
const PAGES = 'pages-v1';
const ASSETS = 'assets-v1';
const MAX_PAGES = 60;
const MAX_ASSETS = 120;
const scope = new URL(self.registration.scope);
const at = (p) => new URL(p, scope).href;
const SHELL_FILES = ['./', './offline/', './style.css', './app.js', './favicon.svg', './icon-192.png', './site.webmanifest', './fonts/ibm-plex-mono-latin-400-normal.woff2', './fonts/vt323-latin-400-normal.woff2'].map(at);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(k);
}

async function networkFirst(request, name, max, fallback) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const copy = res.clone();
      caches.open(name).then((c) => c.put(request, copy)).then(() => trim(name, max));
    }
    return res;
  } catch (err) {
    // This cache first: the shell cache also holds the home page, from install time.
    return (await (await caches.open(name)).match(request)) || (await caches.match(request)) || (fallback && (await caches.match(fallback))) || Response.error();
  }
}

async function asset(request, event) {
  const cached = await caches.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(ASSETS).then((c) => c.put(request, copy)).then(() => trim(ASSETS, MAX_ASSETS));
      }
      return res;
    })
    .catch(() => cached || Response.error());
  if (cached) {
    event.waitUntil(fresh);
    return cached;
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (url.pathname.endsWith('/sw.js')) return;
  if (request.mode === 'navigate') return event.respondWith(networkFirst(request, PAGES, MAX_PAGES, at('./offline/')));
  if (/\\.(css|js|json|webmanifest)$/.test(url.pathname)) return event.respondWith(networkFirst(request, ASSETS, MAX_ASSETS));
  if (/\\.(svg|png|ico|webp|woff2)$/.test(url.pathname)) return event.respondWith(asset(request, event));
});
`;
}

module.exports = { homeMd, entryMd, systemMd, compareMd, alternativesMd, featureMd, setupMd, indexMd, compareIndexMd, alternativesIndexMd, featuresIndexMd, systemsIndexMd, llmsTxt, llmsFullTxt, entryJson, clientsJson, searchJson, sitemap, sitemapIndex, robots, feed, manifest, serviceWorker };
