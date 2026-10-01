'use strict';

// Everything the templates need, computed once from the data files: clients with their paths,
// per-system lists, comparisons, alternatives and feature lists.

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const lib = require('./lib');

const { ROOT, readYaml, OSES, SUPPORT, PROTOCOLS, LICENSES, licenseParts, isOpenSource } = lib;

const site = readYaml(path.join(ROOT, 'site.yml'));
const BASE = (process.env.BASE_PATH ?? site.base_path ?? '').replace(/\/$/, '');
const SITE_URL = (process.env.SITE_URL || site.url).replace(/\/$/, '');
const REPO = `https://github.com/${site.repo}`;

const { clients: loaded, errors } = lib.loadClients();
if (errors.length) throw new Error(`Invalid data:\n${errors.join('\n')}`);

// ---------- last modified dates from git ----------

function gitDates() {
  const dates = {};
  try {
    const out = execFileSync('git', ['log', '--format=@%cI', '--name-only', '--no-renames'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    let current = null;
    for (const line of out.split('\n')) {
      if (line.startsWith('@')) current = line.slice(1);
      else if (line && current && !dates[line]) dates[line] = current;
    }
  } catch {}
  return dates;
}
const DATES = gitDates();
const NOW = new Date().toISOString();
const lastmod = (...files) => files.map((f) => DATES[f]).filter(Boolean).sort().pop() || null;
const newest = (list) => list.map((x) => x.lastmod).filter(Boolean).sort().pop() || null;

// ---------- clients ----------

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
const supports = (c, os) => SUPPORT[c.platforms[os].support].ok;

const entries = loaded
  .map((c) => ({
    ...c,
    path: `/${c.type === 'tool' ? 'tools' : 'clients'}/${c.slug}/`,
    lastmod: lastmod(c.file),
    openSource: isOpenSource(c.license),
    licenses: licenseParts(c.license),
    oses: OSES.filter((o) => supports(c, o.id)).map((o) => o.id)
  }))
  // The featured client first, then maintained software, then by name.
  .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.maintained ? 1 : 0) - (a.maintained ? 1 : 0) || byName(a, b));

const featured = entries.find((e) => e.featured) || null;
const clients = entries.filter((e) => e.type === 'client');
const tools = entries.filter((e) => e.type === 'tool');
const bySlug = new Map(entries.map((e) => [e.slug, e]));

// ---------- systems ----------

const systems = OSES.map((o) => ({
  ...o,
  path: `/${o.id}/`,
  clients: clients.filter((c) => supports(c, o.id)),
  tools: tools.filter((c) => supports(c, o.id)),
  native: clients.filter((c) => c.platforms[o.id].support === 'native')
}));

// ---------- comparisons: every pair of clients ----------

const comparisons = [];
for (let i = 0; i < clients.length; i++) {
  for (let j = i + 1; j < clients.length; j++) {
    const [a, b] = [clients[i], clients[j]].sort((x, y) => x.slug.localeCompare(y.slug));
    comparisons.push({ a, b, slug: `${a.slug}-vs-${b.slug}`, path: `/compare/${a.slug}-vs-${b.slug}/` });
  }
}
comparisons.sort((x, y) => x.slug.localeCompare(y.slug));
const comparisonFor = (x, y) => comparisons.find((c) => (c.a.slug === x.slug && c.b.slug === y.slug) || (c.a.slug === y.slug && c.b.slug === x.slug)) || null;

// ---------- alternatives: other clients, most similar first ----------

const has = (v) => v === true || (typeof v === 'string' && v.length > 0);
function similarity(a, b) {
  let s = 0;
  if (a.interface === b.interface) s += 4;
  for (const [k] of PROTOCOLS) if (a.protocols[k] === true && b.protocols[k] === true) s += 1;
  for (const os of a.oses) if (b.oses.includes(os)) s += 1;
  if (b.maintained) s += 2;
  if (a.lineage && b.lineage && (a.lineage.includes(b.name) || b.lineage.includes(a.name))) s += 3;
  return s;
}
const alternatives = clients.map((entry) => ({
  entry,
  path: `/alternatives/${entry.slug}/`,
  list: clients
    .filter((c) => c !== entry)
    .map((c) => [similarity(entry, c), c])
    .sort((x, y) => y[0] - x[0] || byName(x[1], y[1]))
    .map(([, c]) => c)
}));

// ---------- feature lists ----------

const FEATURE_LISTS = [
  { slug: 'pgp', title: 'Terminal email clients with PGP', h1: 'Terminal email clients with OpenPGP', test: (c) => has(c.features.pgp), intro: 'Clients that sign and encrypt mail with OpenPGP, built in or through a plugin.' },
  { slug: 'imap', title: 'Terminal email clients with IMAP', h1: 'Terminal email clients with built-in IMAP', test: (c) => c.protocols.imap === true, intro: 'Clients that talk to an IMAP server directly, with no separate sync program.' },
  { slug: 'pop3', title: 'Terminal email clients with POP3', h1: 'Terminal email clients with POP3', test: (c) => c.protocols.pop3 === true, intro: 'Clients that download mail over POP3 themselves.' },
  { slug: 'jmap', title: 'Terminal email clients with JMAP', h1: 'Terminal email clients with JMAP', test: (c) => c.protocols.jmap === true, intro: 'Clients that support JMAP, the JSON-based protocol that replaces IMAP for providers that offer it.' },
  { slug: 'maildir', title: 'Maildir email clients', h1: 'Terminal email clients that read Maildir', test: (c) => c.protocols.maildir === true, intro: 'Clients that read local Maildir folders, which tools like mbsync and OfflineIMAP keep in sync with a server.' },
  { slug: 'notmuch', title: 'notmuch email clients', h1: 'Email clients for notmuch', test: (c) => c.protocols.notmuch === true, intro: 'Clients that use a notmuch database for tags and fast full-text search.' },
  { slug: 'oauth2', title: 'Terminal email clients with OAuth2', h1: 'Terminal email clients with OAuth2 sign-in', test: (c) => has(c.features.oauth2), intro: 'Clients that can sign in to Gmail and Microsoft 365 with OAuth2, built in or with a helper script.' },
  { slug: 'mouse', title: 'Terminal email clients with mouse support', h1: 'Terminal email clients you can use with a mouse', test: (c) => c.features.mouse === true, intro: 'Clients that respond to mouse clicks and scrolling as well as the keyboard.' },
  { slug: 'vim-keys', title: 'Email clients with Vim keys', h1: 'Terminal email clients with Vim-style keys', test: (c) => c.features.vim_keys === true, intro: 'Clients that use Vim-style movement keys such as j and k out of the box.' },
  { slug: 'calendar', title: 'Terminal email clients with a calendar', h1: 'Terminal email clients with calendar support', test: (c) => has(c.features.calendar), intro: 'Clients that show calendar invites or include a calendar.' },
  { slug: 'emacs', title: 'Emacs email clients', h1: 'Email clients for Emacs', test: (c) => c.interface === 'emacs', intro: 'Mail readers that run inside Emacs and use its buffers and keys.' },
  { slug: 'open-source', title: 'Open-source terminal email clients', h1: 'Open-source terminal email clients', test: (c) => c.openSource, intro: 'Clients released under an open-source license.' }
].map((f) => ({ ...f, path: `/features/${f.slug}/` }));
const features = FEATURE_LISTS.map((f) => ({ ...f, list: clients.filter(f.test) })).filter((f) => f.list.length >= 2);

// ---------- pages ----------

const pages = lib.loadPages();
const DOCS = [['CONTRIBUTING.md', 'contribute', 'Contribute', 'How to suggest a client, correct a fact or improve the site on GitHub.']].map(([file, slug, title, description]) => ({
  file,
  slug,
  title,
  description,
  path: `/${slug}/`,
  body: require('node:fs').readFileSync(path.join(ROOT, file), 'utf8')
}));

// Forward Email's own server settings, shown on every client page.
const FE_SETTINGS = [
  ['IMAP', 'imap.forwardemail.net', '993', 'SSL/TLS'],
  ['POP3', 'pop3.forwardemail.net', '995', 'SSL/TLS'],
  ['SMTP', 'smtp.forwardemail.net', '465', 'SSL/TLS'],
  ['SMTP', 'smtp.forwardemail.net', '587', 'STARTTLS']
];

module.exports = {
  site,
  BASE,
  SITE_URL,
  REPO,
  NOW,
  lastmod,
  newest,
  entries,
  clients,
  tools,
  featured,
  bySlug,
  systems,
  comparisons,
  comparisonFor,
  alternatives,
  features,
  pages,
  DOCS,
  FE_SETTINGS,
  LICENSES,
  has
};
