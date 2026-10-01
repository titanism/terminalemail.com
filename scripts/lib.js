'use strict';

// Loading and checking the data files. Every page is generated from clients/*.yml, pages/*.md
// and site.yml, so this is the one place that decides what valid data looks like.

const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const ROOT = path.join(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'clients');

const readYaml = (file) => YAML.parse(fs.readFileSync(file, 'utf8'));

// ---------- vocabularies ----------

const OSES = [
  { id: 'linux', name: 'Linux', short: 'LNX', blurb: 'Debian, Ubuntu, Fedora, Arch and other distributions' },
  { id: 'macos', name: 'macOS', short: 'MAC', blurb: 'Apple Silicon and Intel Macs, mostly through Homebrew' },
  { id: 'windows', name: 'Windows', short: 'WIN', blurb: 'Windows 10 and 11, natively or through WSL' },
  { id: 'bsd', name: 'BSD', short: 'BSD', blurb: 'FreeBSD, OpenBSD and NetBSD' },
  { id: 'android', name: 'Android', short: 'AND', blurb: 'Android phones and tablets through Termux' }
];
const OS_IDS = OSES.map((o) => o.id);

// label: table cells. tip: after "Windows: ". phrase: after a name, as in "aerc runs through WSL".
const SUPPORT = {
  native: { label: 'Native', short: 'native', tip: 'native', phrase: 'runs natively', ok: true },
  wsl: { label: 'Through WSL', short: 'WSL', tip: 'through WSL', phrase: 'runs through WSL', ok: true },
  termux: { label: 'Through Termux', short: 'Termux', tip: 'through Termux', phrase: 'runs through Termux', ok: true },
  source: { label: 'Build from source', short: 'source', tip: 'build from source', phrase: 'builds from source', ok: true },
  none: { label: 'Not supported', short: 'no', tip: 'not available', phrase: 'is not available', ok: false }
};

// long: a label. noun: in a sentence, as in "NeoMutt is a full-screen terminal client".
const INTERFACES = {
  tui: { label: 'TUI', long: 'Full-screen terminal interface', noun: 'a full-screen terminal client' },
  cli: { label: 'CLI', long: 'Command-line tools and prompts', noun: 'a command-line program' },
  emacs: { label: 'Emacs', long: 'Runs inside Emacs', noun: 'a mail client that runs inside Emacs' },
  vim: { label: 'Vim', long: 'Runs inside Vim or Neovim', noun: 'a plugin for Vim or Neovim' }
};

const TYPES = { client: 'Email client', tool: 'Mail tool' };

const PROTOCOLS = [
  ['imap', 'IMAP'],
  ['pop3', 'POP3'],
  ['smtp', 'SMTP'],
  ['jmap', 'JMAP'],
  ['maildir', 'Maildir'],
  ['mbox', 'mbox'],
  ['notmuch', 'notmuch']
];

const FEATURES = [
  ['pgp', 'OpenPGP'],
  ['smime', 'S/MIME'],
  ['oauth2', 'OAuth2 sign-in'],
  ['threads', 'Threads'],
  ['search', 'Search'],
  ['html', 'HTML mail'],
  ['mouse', 'Mouse'],
  ['multiple_accounts', 'Multiple accounts'],
  ['offline', 'Offline use'],
  ['calendar', 'Calendar'],
  ['contacts', 'Contacts'],
  ['vim_keys', 'Vim-style keys'],
  ['config', 'Configuration']
];

// Licenses used by the listed software. `osi` marks OSI-approved open-source licenses.
const LICENSES = {
  'MIT': { name: 'MIT', url: 'https://spdx.org/licenses/MIT.html', osi: true },
  'Apache-2.0': { name: 'Apache 2.0', url: 'https://spdx.org/licenses/Apache-2.0.html', osi: true },
  'ISC': { name: 'ISC', url: 'https://spdx.org/licenses/ISC.html', osi: true },
  'BSD-2-Clause': { name: 'BSD 2-Clause', url: 'https://spdx.org/licenses/BSD-2-Clause.html', osi: true },
  'BSD-3-Clause': { name: 'BSD 3-Clause', url: 'https://spdx.org/licenses/BSD-3-Clause.html', osi: true },
  'BSD-4-Clause': { name: 'BSD 4-Clause', url: 'https://spdx.org/licenses/BSD-4-Clause.html', osi: false },
  'GPL-2.0-only': { name: 'GPL 2.0', url: 'https://spdx.org/licenses/GPL-2.0-only.html', osi: true },
  'GPL-2.0-or-later': { name: 'GPL 2.0 or later', url: 'https://spdx.org/licenses/GPL-2.0-or-later.html', osi: true },
  'GPL-3.0-only': { name: 'GPL 3.0', url: 'https://spdx.org/licenses/GPL-3.0-only.html', osi: true },
  'GPL-3.0-or-later': { name: 'GPL 3.0 or later', url: 'https://spdx.org/licenses/GPL-3.0-or-later.html', osi: true },
  'EUPL-1.2': { name: 'EUPL 1.2', url: 'https://spdx.org/licenses/EUPL-1.2.html', osi: true },
  'CC0-1.0': { name: 'CC0 1.0', url: 'https://spdx.org/licenses/CC0-1.0.html', osi: false },
  'BUSL-1.1': { name: 'Business Source License 1.1', url: 'https://spdx.org/licenses/BUSL-1.1.html', osi: false, sourceAvailable: true }
};

// An SPDX expression: ids joined by AND or OR. Returns the parts, or null if any id is unknown.
function licenseParts(expr) {
  const ids = String(expr || '').split(/\s+(?:AND|OR)\s+/);
  return ids.every((id) => LICENSES[id]) ? ids.map((id) => ({ id, ...LICENSES[id] })) : null;
}

// Open source when every part is OSI-approved, or when an OR expression offers an OSI license.
// "CC0-1.0 AND MIT" counts too: CC0 is a public domain dedication, which is more permissive.
function isOpenSource(expr) {
  const s = String(expr || '');
  const parts = licenseParts(s);
  if (!parts) return false;
  if (/\sOR\s/.test(s)) return parts.some((p) => p.osi);
  return parts.every((p) => p.osi || p.id === 'CC0-1.0' || p.id === 'BSD-4-Clause');
}

// ---------- validation ----------

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HTML = /<\/?[a-z][\s\S]*?>|javascript:/i;
const PLACEHOLDER = /\b(TODO|TBD|FIXME|lorem ipsum)\b/i;
const httpUrl = (s) => {
  if (typeof s !== 'string' || !/^https?:\/\/[^\s"'<>\\]+$/i.test(s)) return false;
  try {
    return /^https?:$/.test(new URL(s).protocol);
  } catch {
    return false;
  }
};

// Returns a list of problems with one client record. An empty list means it is valid.
function validateClient(c, file = 'client') {
  const errors = [];
  const err = (m) => errors.push(`${file}: ${m}`);
  if (!c || typeof c !== 'object' || Array.isArray(c)) return [`${file}: must be a YAML mapping`];
  const text = (key, { max = 0, required = true } = {}) => {
    const v = c[key];
    if (v === undefined || v === null || v === '') {
      if (required) err(`${key} is required`);
      return;
    }
    if (typeof v !== 'string') return err(`${key} must be text`);
    if (HTML.test(v)) err(`${key} must not contain HTML`);
    if (PLACEHOLDER.test(v)) err(`${key} contains a placeholder`);
    if (max && [...v].length > max) err(`${key} is longer than ${max} characters`);
  };

  text('name', { max: 40 });
  if (typeof c.slug !== 'string' || !SLUG.test(c.slug)) err('slug must be lowercase kebab-case');
  if (file !== 'client' && c.slug && path.basename(file, '.yml') !== c.slug) err(`slug ${c.slug} does not match the file name`);
  if (!TYPES[c.type]) err(`type must be one of ${Object.keys(TYPES).join(', ')}`);
  if (!INTERFACES[c.interface]) err(`interface must be one of ${Object.keys(INTERFACES).join(', ')}`);
  text('summary', { max: 160 });
  text('description', { max: 900 });
  text('language', { max: 60 });
  text('latest_version', { max: 40, required: false });
  text('lineage', { max: 120, required: false });
  text('backend', { max: 120, required: false });
  text('account', { max: 240, required: false });
  if (typeof c.license !== 'string' || !licenseParts(c.license)) err(`license must be a known SPDX expression (add new ids to LICENSES in scripts/lib.js)`);
  if (typeof c.maintained !== 'boolean') err('maintained must be true or false');
  if (c.featured !== undefined && typeof c.featured !== 'boolean') err('featured must be true or false');
  for (const key of ['website', 'repo', 'docs']) if (c[key] !== undefined && !httpUrl(c[key])) err(`${key} must be an http(s) URL`);
  if (!c.website && !c.repo) err('website or repo is required');
  if (c.aliases !== undefined && (!Array.isArray(c.aliases) || c.aliases.some((a) => typeof a !== 'string' || HTML.test(a)))) err('aliases must be a list of text');

  if (!c.platforms || typeof c.platforms !== 'object') err('platforms is required');
  else {
    for (const os of OS_IDS) {
      const p = c.platforms[os];
      if (!p || typeof p !== 'object') {
        err(`platforms.${os} is required`);
        continue;
      }
      if (!SUPPORT[p.support]) err(`platforms.${os}.support must be one of ${Object.keys(SUPPORT).join(', ')}`);
      if (p.support === 'wsl' && os !== 'windows') err(`platforms.${os}.support: wsl is only for Windows`);
      if (p.support === 'termux' && os !== 'android') err(`platforms.${os}.support: termux is only for Android`);
      if (p.note !== undefined && (typeof p.note !== 'string' || HTML.test(p.note))) err(`platforms.${os}.note must be text without HTML`);
      if (p.install !== undefined) {
        if (!Array.isArray(p.install)) err(`platforms.${os}.install must be a list`);
        else
          for (const [i, step] of p.install.entries()) {
            if (!step || typeof step.via !== 'string' || typeof step.cmd !== 'string' || !step.via.trim() || !step.cmd.trim()) err(`platforms.${os}.install[${i}] needs via and cmd`);
            else if (/[\r\n]/.test(step.cmd)) err(`platforms.${os}.install[${i}].cmd must be one line`);
          }
      }
      if (p.support === 'none' && p.install?.length) err(`platforms.${os}: install commands listed for an unsupported system`);
    }
    for (const k of Object.keys(c.platforms)) if (!OS_IDS.includes(k)) err(`platforms.${k} is not a known system`);
  }

  if (!c.protocols || typeof c.protocols !== 'object') err('protocols is required');
  else
    for (const [k] of PROTOCOLS) {
      const v = c.protocols[k];
      if (v !== true && v !== false && v !== 'external') err(`protocols.${k} must be true, false or "external"`);
    }

  if (!c.features || typeof c.features !== 'object') err('features is required');
  else
    for (const [k] of FEATURES) {
      const v = c.features[k];
      if (typeof v !== 'boolean' && typeof v !== 'string') err(`features.${k} must be true, false or a short text`);
      else if (typeof v === 'string' && (HTML.test(v) || [...v].length > 140)) err(`features.${k} must be short text without HTML`);
    }

  for (const key of ['pros', 'cons']) {
    const list = c[key];
    if (!Array.isArray(list) || list.length < 2) err(`${key} needs at least two items`);
    else if (list.some((s) => typeof s !== 'string' || HTML.test(s) || PLACEHOLDER.test(s) || [...s].length > 160)) err(`${key} items must be short text without HTML`);
  }
  if (typeof c.forward_email !== 'string' || !c.forward_email.trim()) err('forward_email (a setup example) is required');
  if (c.forward_email_file !== undefined && typeof c.forward_email_file !== 'string') err('forward_email_file must be text');
  if (!Array.isArray(c.sources) || !c.sources.length || c.sources.some((s) => !httpUrl(s))) err('sources must list the http(s) URLs the facts came from');
  if (c.screenshots !== undefined) {
    if (!Array.isArray(c.screenshots)) err('screenshots must be a list');
    else if (!c.screenshots.length) err('screenshots must list at least one screenshot, or be left out');
    else for (const s of c.screenshots) if (!s || !SLUG.test(String(s.name)) || typeof s.alt !== 'string' || !s.alt.trim()) err('each screenshot needs a name (kebab-case) and alt text');
  }
  return errors;
}

// ---------- loading ----------

function loadClients() {
  const files = fs.readdirSync(CLIENT_DIR).filter((f) => f.endsWith('.yml')).sort();
  const clients = [];
  const errors = [];
  for (const f of files) {
    const rel = `clients/${f}`;
    let data;
    try {
      data = readYaml(path.join(CLIENT_DIR, f));
    } catch (e) {
      errors.push(`${rel}: ${e.message}`);
      continue;
    }
    const problems = validateClient(data, rel);
    if (problems.length) errors.push(...problems);
    else clients.push({ ...data, file: rel });
  }
  const seen = new Map();
  for (const c of clients) {
    if (seen.has(c.slug)) errors.push(`${c.file}: slug ${c.slug} is also used by ${seen.get(c.slug)}`);
    seen.set(c.slug, c.file);
  }
  if (clients.filter((c) => c.featured).length !== 1) errors.push('Exactly one client must be featured (featured: true)');
  return { clients, errors };
}

// Pages written in Markdown, with front matter (title, description, slug).
function loadPages(dir = path.join(ROOT, 'pages')) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
      if (!m) throw new Error(`pages/${f}: missing front matter`);
      const meta = YAML.parse(m[1]) || {};
      const slug = meta.slug || path.basename(f, '.md');
      if (!SLUG.test(slug)) throw new Error(`pages/${f}: slug must be lowercase kebab-case`);
      if (!meta.title || !meta.description) throw new Error(`pages/${f}: title and description are required`);
      return { ...meta, slug, path: `/${slug}/`, file: `pages/${f}`, body: raw.slice(m[0].length).trim() + '\n' };
    });
}

module.exports = { ROOT, readYaml, OSES, OS_IDS, SUPPORT, INTERFACES, TYPES, PROTOCOLS, FEATURES, LICENSES, licenseParts, isOpenSource, httpUrl, validateClient, loadClients, loadPages };
