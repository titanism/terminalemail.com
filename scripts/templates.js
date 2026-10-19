'use strict';

// HTML templates. Every page is plain, semantic HTML with structured data, and works without
// JavaScript. site/app.js adds filtering, tabs, search and sharing on top.

const crypto = require('node:crypto');
const { Marked } = require('marked');
const ctx = require('./context');
const i18n = require('./i18n');
const lib = require('./lib');
const { t, th } = i18n;

const { site, BASE, SITE_URL, REPO, entries, clients, tools, featured, systems, comparisons, comparisonFor, alternatives, features, pages, DOCS, FE_SETTINGS, has } = ctx;
const { OSES, SUPPORT, INTERFACES, TYPES, PROTOCOLS, FEATURES } = lib;

// ---------- helpers ----------

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const u = (p) => `${BASE}${p}`;
const abs = (p) => `${SITE_URL}${p}`;

// An absolute http(s) URL from data, or null. Anything else (javascript:, data:, relative
// paths, text with quotes or spaces) is not linked.
const httpUrl = (value) => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!/^https?:\/\/[^\s"'<>\\]+$/i.test(s)) return null;
  try {
    return /^https?:$/.test(new URL(s).protocol) ? s : null;
  } catch {
    return null;
  }
};
const hostname = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
const ext = (url, text) => (httpUrl(url) ? `<a href="${esc(httpUrl(url))}" rel="noopener">${esc(text ?? hostname(url))}</a>` : esc(text ?? ''));

// Links allowed in Markdown: http(s), mailto, same-page anchors and relative paths.
const stripControls = (href) => String(href ?? '').replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
const safeMdHref = (href) => {
  const s = stripControls(href);
  if (!s) return false;
  const head = s.split(/[/?#]/, 1)[0];
  if (!head.includes(':') && !head.includes('&')) return true;
  return /^(https?:\/\/|mailto:)/i.test(s);
};
const mdHref = (href) => {
  try {
    return encodeURI(stripControls(href).replace(/^[a-z][a-z0-9+.-]*:/i, (m) => m.toLowerCase())).replace(/%25/g, '%');
  } catch {
    return null;
  }
};

// Markdown comes from contributors, so raw HTML is shown as text, and links and images with
// unsafe URLs are dropped (their text is kept).
const mdParser = new Marked({
  gfm: true,
  renderer: {
    html({ text }) {
      return esc(text);
    },
    link(token) {
      const text = this.parser.parseInline(token.tokens);
      const href = safeMdHref(token.href) ? mdHref(token.href) : null;
      if (href === null) return text;
      return `<a href="${esc(href)}"${token.title ? ` title="${esc(token.title)}"` : ''}>${text}</a>`;
    },
    image(token) {
      const alt = token.tokens ? this.parser.parseInline(token.tokens, this.parser.textRenderer) : token.text;
      const href = stripControls(token.href);
      if (/^https?:\/\//i.test(href) && mdHref(href) !== null) return `<a href="${esc(mdHref(href))}">${esc(alt)}</a>`;
      const src = /^\/(?!\/)/.test(href) ? mdHref(href) : null;
      if (src === null) return esc(alt);
      return `<img src="${esc(src)}" alt="${esc(alt)}"${token.title ? ` title="${esc(token.title)}"` : ''}>`;
    }
  }
});

function headingSlug(inner) {
  return String(inner)
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, '')
    .normalize('NFKD')
    .replace(/(\p{Script=Latin})\p{M}+/gu, '$1')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

const DOC_LINKS = { 'CONTRIBUTING.md': '/contribute/' };

function md(text) {
  let html = mdParser.parse(text || '');
  for (const [file, page] of Object.entries(DOC_LINKS)) html = html.replaceAll(`href="${file}`, `href="${u(page)}`);
  html = html.replace(/href="(\/(?!\/)[^"]*)"/g, (_, p) => `href="${u(p)}"`);
  html = html.replace(/<img src="(\/(?!\/)[^"]*)"/g, (_, p) => `<img src="${BASE}${p}"`);
  // Other relative links point at files in the repository. Leading "./" and "../" are dropped.
  html = html.replace(/href="(?!https?:|#|\/|mailto:)([^"]+)"/g, (_, p) => `href="${REPO}/blob/${site.branch}/${p.replace(/^(?:\.{1,2}\/)+/, '')}"`);
  html = html.replace(/<a href="(?:https?:)?\/\/(?!terminalemail\.com[/"])/g, (m) => m.replace('<a ', '<a rel="noopener" '));
  const seen = new Set();
  html = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, n, inner) => {
    const base = headingSlug(inner) || 'section';
    let id = base;
    for (let k = 2; seen.has(id); k++) id = `${base}-${k}`;
    seen.add(id);
    return `<h${n} id="${esc(id)}">${inner}</h${n}>`;
  });
  html = html.replace(/<table>/g, '<div class="table-wrap" tabindex="0"><table>').replace(/<\/table>/g, '</table></div>');
  html = html.replace(/<pre>/g, '<pre tabindex="0">');
  return html;
}

// The first candidate no longer than `max` characters, or the last one. Titles and descriptions
// use it to say as much as fits in a search result.
const fit = (max, ...candidates) => candidates.find((c) => [...c].length <= max) ?? candidates[candidates.length - 1];

// Shorten text to at most `max` characters, at a sentence end when one ends late enough,
// otherwise at a word boundary with an ellipsis. Counted by code point.
function clip(text, max) {
  const chars = Array.from(String(text ?? '').replace(/\s+/g, ' ').trim());
  if (chars.length <= max) return chars.join('');
  const min = Math.floor(max * 0.6);
  for (let n = max; n >= min; n--) {
    const c = chars[n - 1];
    if (/[.!?]/.test(c) && chars[n] === ' ') return chars.slice(0, n).join('');
  }
  const cut = chars.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  const words = space >= min ? cut.slice(0, space) : cut;
  return `${words.join('').replace(/[\s,;:–—-]+$/u, '')}…`;
}

const joinList = (items, conj = 'and') => {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list.join('');
  if (list.length === 2) return `${list[0]} ${conj} ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} ${conj} ${list[list.length - 1]}`;
};
const osName = (id) => OSES.find((o) => o.id === id).name;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const licenseText = (e) => e.licenses.map((l) => l.name).join(e.license.includes(' OR ') ? ' or ' : ' and ');
const licenseHtml = (e) => e.licenses.map((l) => `<a href="${esc(l.url)}" rel="noopener license">${esc(l.name)}</a>`).join(e.license.includes(' OR ') ? ' or ' : ' and ');

// ---------- support and features ----------

// One sentence a screen reader reads instead of the symbol grid.
function supportSentence(e) {
  const by = (kind) => OSES.filter((o) => e.platforms[o.id].support === kind).map((o) => o.name);
  const parts = [];
  if (by('native').length) parts.push(`Runs on ${joinList(by('native'))}`);
  if (by('wsl').length) parts.push('on Windows through WSL');
  if (by('termux').length) parts.push('on Android through Termux');
  if (by('source').length) parts.push(`builds from source on ${joinList(by('source'))}`);
  const none = by('none');
  return `${parts.join(', ') || 'No packaged systems'}${none.length ? `. Not available for ${joinList(none, 'or')}` : ''}.`;
}

function osMatrix(e) {
  const cells = OSES.map((o) => {
    const s = e.platforms[o.id].support;
    const tip = `${o.name}: ${SUPPORT[s].tip}`;
    return `<span class="s-${s}" data-tip="${esc(tip)}">${esc(o.short)}</span>`;
  }).join('');
  return `<span class="osm" aria-hidden="true">${cells}</span><span class="sr">${esc(supportSentence(e))}</span>`;
}

const osKey = () => `<p class="osm-key" aria-hidden="true"><span><span class="osm"><span class="s-native">LNX</span></span> native</span><span><span class="osm"><span class="s-wsl">WIN</span></span> through WSL, Termux or a source build</span><span><span class="osm"><span class="s-none">BSD</span></span> not available</span></p>`;

// A feature value as HTML: yes, no, or the short description from the data.
function cell(v, { external = 'Through a separate tool' } = {}) {
  if (v === true) return '<span class="yes">Yes</span>';
  if (v === false || v === undefined || v === '') return '<span class="no">No</span>';
  if (v === 'external') return `<span class="part">${esc(external)}</span>`;
  return `<span class="part">${esc(v)}</span>`;
}
const cellText = (v) => (v === true ? 'Yes' : v === false || v === undefined || v === '' ? 'No' : v === 'external' ? 'Through a separate tool' : String(v));

function interfaceTag(e) {
  return `<span class="tag" data-tip="${esc(INTERFACES[e.interface].long)}">${esc(INTERFACES[e.interface].label)}</span>`;
}
function tags(e, { type = false } = {}) {
  return [
    e.featured ? `<span class="tag tag-featured">${th('Featured')}</span>` : '',
    interfaceTag(e),
    type ? `<span class="tag">${esc(TYPES[e.type])}</span>` : '',
    e.openSource ? '' : `<span class="tag" data-tip="${esc(`Source code is public under the ${licenseText(e)}, which is not an open-source license`)}">${th('Source-available')}</span>`,
    e.maintained ? '' : `<span class="tag tag-stale" data-tip="No commits or releases in about a year">${th('Not maintained')}</span>`
  ].join('');
}

// The words a filter matches: name, aliases, language, license, interface and protocols.
function filterText(e) {
  const protos = PROTOCOLS.filter(([k]) => e.protocols[k] === true).map(([, n]) => n);
  return [e.name, e.slug, ...(e.aliases || []), e.language, e.license, INTERFACES[e.interface].label, TYPES[e.type], ...protos, e.summary].join(' ').toLowerCase();
}

// ---------- the listing table ----------

function listing(list, { caption, os = null, id = '', empty = 'Nothing matches.' } = {}) {
  const rows = list
    .map((e) => {
      const cmd = os ? e.platforms[os].install?.[0] : null;
      return `<tr data-os="${esc(e.oses.join(' '))}" data-name="${esc(filterText(e))}">
<td class="os-col">${osMatrix(e)}</td>
<td class="name"><a href="${u(e.path)}">${esc(e.name)}</a>${tags(e)}<span class="sum">${esc(e.summary)}</span></td>
${os ? `<td class="cmdcell">${cmd ? `<code>${esc(cmd.cmd)}</code>` : `<span class="muted">${esc(SUPPORT[e.platforms[os].support].label)}</span>`}</td>` : `<td class="meta">${esc(e.language)}<br>${esc(licenseText(e))}</td>`}
</tr>`;
    })
    .join('\n');
  return `<div class="table-scroll" tabindex="0"><table class="listing stack"${id ? ` id="${esc(id)}"` : ''}>
${caption ? `<caption>${esc(caption)}</caption>` : ''}
<thead><tr><th scope="col">${th('Systems')}</th><th scope="col">${th('Name')}</th><th scope="col">${os ? th('Install on {os}', { os: esc(osName(os)) }) : th('Language and license')}</th></tr></thead>
<tbody>
${rows}
<tr class="empty-row" data-empty hidden><td colspan="3">${esc(empty)}</td></tr>
</tbody>
</table></div>`;
}

// OS chips. Without scripts they are links to each system's page; app.js filters in place.
function osChips(current = null, { filter = true, any = null } = {}) {
  const all = `<a class="os-chip" href="${any ? u(any) : current ? u('/clients/') : `${u('/')}#clients`}" data-os-chip=""${filter && !current ? ' aria-current="true" data-filter-chip' : ''}>any<span class="n">${clients.length}</span></a>`;
  const chips = systems.map((s) => `<a class="os-chip" href="${u(s.path)}" data-os-chip="${s.id}"${current === s.id ? ' aria-current="page"' : filter ? ' data-filter-chip' : ''}>${esc(s.id)}<span class="n">${s.clients.length}</span></a>`).join('');
  return `<nav class="os-pick" aria-label="${esc(t('Filter by operating system'))}"><span class="flag" aria-hidden="true">--os=</span>${all}${chips}</nav>`;
}

function filterRow(label = 'Filter clients by name, language or protocol') {
  return `<div class="filter-row"><div class="filter-field"><label class="sr" for="filter">${esc(label)}</label><input id="filter" type="search" placeholder="${esc(t('filter: neomutt, rust, jmap…'))}" autocomplete="off" spellcheck="false" data-filter></div><span class="filter-count" data-count aria-live="polite"></span></div>`;
}

// ---------- commands ----------

const copyBtn = (text) => `<button class="copy" type="button" data-copy-text="${esc(text)}" aria-label="${esc(t('Copy command'))}">${th('copy')}</button>`;
const cmdLine = (cmd, label = '') => `<div class="cmd"><div class="cmd-body">${label ? `<span class="cmd-label">${esc(label)}</span>` : ''}<code>${esc(cmd)}</code></div>${copyBtn(cmd)}</div>`;

function codeBlock(code, { title = '', lang = '' } = {}) {
  const body = String(code).replace(/\n+$/, '');
  return `<div class="code-block">${title ? `<div class="code-head"><span>${esc(title)}</span>${copyBtn(body)}</div>` : ''}<pre tabindex="0"><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(body)}</code></pre></div>`;
}

// Install commands for one system as a tab panel (or plain blocks without scripts).
function installTabs(e, { idp = 'inst' } = {}) {
  const oses = OSES.filter((o) => e.platforms[o.id].support !== 'none' && e.platforms[o.id].install?.length);
  if (!oses.length) return '';
  const tabs = oses.map((o, i) => `<li role="presentation"><button type="button" role="tab" id="${idp}-tab-${o.id}" aria-controls="${idp}-${o.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(o.name)}</button></li>`).join('');
  const panels = oses
    .map((o, i) => {
      const p = e.platforms[o.id];
      return `<div class="install-panel" role="tabpanel" id="${idp}-${o.id}" aria-labelledby="${idp}-tab-${o.id}"${i ? ' data-hide' : ''}><h3 class="sr">${esc(o.name)}</h3>${p.install.map((s) => cmdLine(s.cmd, s.via)).join('')}${p.note ? `<p class="muted small">${esc(p.note)}</p>` : ''}</div>`;
    })
    .join('');
  return `<div class="install" data-tabs><ul class="install-tabs" role="tablist" aria-label="${esc(t('Operating system'))}">${tabs}</ul>${panels}</div>`;
}

// ---------- structured data ----------

// Forward Email, as forwardemail.net describes itself in its own structured data.
const FORWARD_EMAIL = {
  '@type': 'Organization',
  '@id': 'https://forwardemail.net/#organization',
  name: 'Forward Email',
  legalName: 'Forward Email LLC',
  url: 'https://forwardemail.net',
  logo: { '@type': 'ImageObject', url: 'https://forwardemail.net/img/logo-square-180x180.png', width: 180, height: 180 },
  sameAs: ['https://github.com/forwardemail', 'https://x.com/fwdemail', 'https://www.reddit.com/r/forwardemail/', 'https://www.youtube.com/forwardemail']
};

const ORG = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: site.title,
  url: `${SITE_URL}/`,
  description: site.tagline,
  logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
  image: `${SITE_URL}/og.png`,
  sameAs: [REPO],
  // Corrections and suggestions go through GitHub issues; there is no phone or postal contact.
  contactPoint: { '@type': 'ContactPoint', contactType: 'corrections and suggestions', url: `${REPO}/issues`, availableLanguage: 'en' },
  parentOrganization: FORWARD_EMAIL
};
const website = () => ({
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: site.title,
  description: site.tagline,
  url: `${SITE_URL}/`,
  inLanguage: 'en',
  publisher: { '@id': `${SITE_URL}/#organization` },
  potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' }
});
const breadcrumbs = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(p) })) });
const itemList = (name, list) => ({ '@type': 'ItemList', name, numberOfItems: list.length, itemListElement: list.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(e.path), name: e.name })) });
const faqLd = (qa) => ({ '@type': 'FAQPage', mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })) });

const OS_LD = { linux: 'Linux', macos: 'macOS', windows: 'Windows', bsd: 'FreeBSD, OpenBSD, NetBSD', android: 'Android' };
function softwareLd(e) {
  const shots = (e.screenshots || []).map((s) => abs(`/screenshots/${e.slug}/dark-${s.name}.webp`));
  return {
    '@type': 'SoftwareApplication',
    '@id': `${abs(e.path)}#software`,
    name: e.name,
    description: e.summary,
    url: abs(e.path),
    sameAs: [e.website, e.repo].filter(Boolean),
    applicationCategory: 'CommunicationApplication',
    applicationSubCategory: e.type === 'tool' ? 'Email utility' : 'Email client',
    operatingSystem: e.oses.map((o) => OS_LD[o]).join(', '),
    softwareVersion: e.latest_version || undefined,
    license: e.licenses.length === 1 ? e.licenses[0].url : undefined,
    isAccessibleForFree: true,
    // Free software; an app that needs a paid account gets no price-0 offer.
    ...(e.account ? {} : { offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } }),
    ...(shots.length ? { screenshot: shots } : {}),
    ...(e.repo ? { codeRepository: e.repo } : {}),
    ...(e.docs ? { softwareHelp: { '@type': 'CreativeWork', url: e.docs } } : {})
  };
}

// ---------- layout ----------

const ICONS = {
  system: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/></svg>'
};

// The logo: a terminal window with a prompt. Colors come from the stylesheet (no inline styles,
// which the Content Security Policy blocks).
const logo = (size = 28) =>
  `<svg class="logo" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><rect class="lg-frame" x="2.5" y="4.5" width="27" height="23" rx="3.5"/><path class="lg-accent" d="M8.5 12.5l5 3.5-5 3.5"/><path class="lg-frame" d="M16 21h7.5"/></svg>`;

const NAV = [
  ['Clients', '/clients/'],
  ['Tools', '/tools/'],
  ['Systems', '/systems/'],
  ['Compare', '/compare/'],
  ['Setup', '/setup/'],
  ['Forward Email app', '/clients/forward-email/'],
  ['About', '/about/']
];

function shareBox(url, text) {
  const U = encodeURIComponent(url);
  const T = encodeURIComponent(text);
  const both = encodeURIComponent(`${text} ${url}`);
  const targets = [
    [t('Messages'), `sms:?body=${both}`],
    [t('Email'), `mailto:?subject=${T}&body=${both}`],
    ['WhatsApp', `https://wa.me/?text=${both}`],
    ['Telegram', `https://t.me/share/url?url=${U}&text=${T}`],
    ['Mastodon', `https://mastodon.social/share?text=${both}`],
    ['Bluesky', `https://bsky.app/intent/compose?text=${both}`],
    ['X (Twitter)', `https://x.com/intent/post?text=${T}&url=${U}`],
    ['Reddit', `https://www.reddit.com/submit?url=${U}&title=${T}`],
    ['Hacker News', `https://news.ycombinator.com/submitlink?u=${U}&t=${T}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${U}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${U}`]
  ];
  // Messages and Email have no recipient, so they are buttons that app.js opens (and shows),
  // not links that crawlers would try to follow.
  const target = ([n, href]) =>
    /^(mailto|sms):/.test(href)
      ? `<li hidden data-share-app><button class="share-to" type="button" data-share-href="${esc(href)}">${esc(n)}</button></li>`
      : `<li><a class="share-to" href="${esc(href)}" rel="nofollow noopener noreferrer" target="_blank"${n === 'Mastodon' ? ' data-mastodon' : ''}>${esc(n)}</a></li>`;
  return `<div id="share" class="share-pop" popover role="dialog" aria-labelledby="share-h" data-share-pop data-url="${esc(url)}" data-text="${esc(text)}">
  <div class="embed-head"><h2 id="share-h">${th('Share')}</h2><button class="icon-btn" type="button" popovertarget="share" popovertargetaction="hide" aria-label="${esc(t('Close'))}">✕</button></div>
  <p class="share-title">${esc(text)}</p>
  <button class="btn share-native" type="button" data-share-native hidden>${ICONS.share}<span>${th('Share with an app on this device')}</span></button>
  <div class="share-link"><label class="sr" for="share-url">${th('Link')}</label><input id="share-url" type="text" value="${esc(url)}" readonly data-share-url><button class="btn btn-quiet" type="button" data-share-copy>${ICONS.link}<span>${th('Copy link')}</span></button></div>
  <ul class="share-grid">${targets.map(target).join('')}</ul>
  <form class="share-mastodon" data-mastodon-form hidden><label for="share-instance">${th('Your Mastodon server')}</label><div><input id="share-instance" type="text" inputmode="url" placeholder="mastodon.social" autocomplete="off" spellcheck="false"><button class="btn" type="submit">${th('Share')}</button></div></form>
  <p class="muted small" data-share-status role="status">${th('These are plain links. No share buttons, scripts or trackers from other sites are loaded.')}</p>
</div>`;
}

// Social images requested by pages. build.js renders them with scripts/og.js.
const ogJobs = [];
const ogFile = (pathname) => `og${pathname === '/' ? '/home' : pathname.replace(/\/$/, '')}.png`;
const ogAlt = (spec) => (spec ? spec.alt || `${spec.title}. ${site.title}.` : `${site.title}: ${site.tagline}`);

// Applied before the first paint so the page does not flash the wrong theme.
// It also marks the page as scripted, so tabs are laid out from the first paint (no layout shift).
const THEME_SCRIPT = `document.documentElement.classList.add('js');try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

// Content Security Policy. GitHub Pages cannot send headers, so it is a <meta> tag: the inline
// theme script is allowed by hash and everything else must come from this site. JSON-LD is data,
// not script, so it needs no hash. frame-ancestors and report-uri are ignored in <meta>.
const scriptHash = (s) => `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const CSP = [
  "default-src 'self'",
  `script-src 'self' ${scriptHash(THEME_SCRIPT)}`,
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'"
].join('; ');

function layout({ title, description, body, pathname, jsonld = [], noindex = false, lastmod = null, type = 'website', markdown = true, share = null, shareable = true, og = null, preloadShot = null }) {
  // The site name is added when the whole title still fits in 60 characters, the length search
  // results show; a longer page title stands alone.
  const suffixed = `${title || 'Terminal email clients for every system'} | ${site.title}`;
  const fullTitle = [...suffixed].length <= 60 || !title ? suffixed : title;
  const text = description || site.tagline;
  const desc = clip(text, 160);
  const socialDesc = clip(text, 200);
  const url = abs(pathname);
  if (og) ogJobs.push({ file: ogFile(pathname), spec: og });
  const image = og ? `${SITE_URL}/${ogFile(pathname)}` : `${SITE_URL}/og.png`;
  const imageAlt = ogAlt(og);
  const IMAGE_TYPES = new Set(['WebPage', 'AboutPage', 'CollectionPage', 'SoftwareApplication', 'Article']);
  const graph = { '@context': 'https://schema.org', '@graph': [ORG, website(), ...jsonld.map((j) => (IMAGE_TYPES.has(j['@type']) && !j.image ? { ...j, image } : j))] };
  const nav = NAV.map(([n, p]) => `<a href="${u(p)}"${pathname === p ? ' aria-current="page"' : ''}>${th(n)}</a>`).join('');
  const mdLink = u(pathname === '/' ? '/index.md' : `${pathname}index.md`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<script>${THEME_SCRIPT}</script>
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
<link rel="canonical" href="${esc(url)}">
${markdown ? `<link rel="alternate" type="text/markdown" href="${esc(mdLink)}" title="Markdown version">\n` : ''}<link rel="alternate" type="application/json" href="${BASE}/api/clients.json" title="All clients as JSON">
<link rel="alternate" type="application/atom+xml" href="${BASE}/feed.xml" title="Changes to the list">
<link rel="preload" href="${BASE}/fonts/ibm-plex-mono-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${BASE}/fonts/vt323-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
${preloadShot ? ['dark', 'light'].map((theme) => `<link rel="preload" as="image" type="image/webp" imagesrcset="${esc(preloadShot[theme])}" imagesizes="${esc(preloadShot.sizes)}" media="${preloadShot.wide ? '(min-width: 980px) and ' : ''}(prefers-color-scheme: ${theme})">\n`).join('') : ''}<meta name="theme-color" content="#fbfbf4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#15110b" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(title || fullTitle)}">
<meta property="og:description" content="${esc(socialDesc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:type" content="${type}">
<meta property="og:locale" content="en_US">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:secure_url" content="${esc(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(imageAlt)}">
${lastmod ? `<meta property="article:modified_time" content="${esc(lastmod)}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title || fullTitle)}">
<meta name="twitter:description" content="${esc(socialDesc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="twitter:image:alt" content="${esc(imageAlt)}">
<link rel="icon" href="${BASE}/favicon.ico" sizes="48x48">
<link rel="icon" href="${BASE}/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${BASE}/apple-touch-icon.png">
<link rel="mask-icon" href="${BASE}/safari-pinned-tab.svg" color="#8a4b00">
<link rel="manifest" href="${BASE}/site.webmanifest">
<meta name="application-name" content="${esc(site.title)}">
<meta name="apple-mobile-web-app-title" content="${esc(site.title)}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="format-detection" content="telephone=no">
<link rel="stylesheet" href="${BASE}/style.css">
${noindex ? '' : `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>\n`}</head>
<body data-base="${esc(BASE)}">
<a class="skip" href="#main">${th('Skip to content')}</a>
<header class="top">
  <div class="wrap top-inner">
    <a class="brand" href="${u('/')}">${logo(28)}<span>${esc(site.title)}</span></a>
    <nav class="nav-desktop" aria-label="${esc(t('Main'))}">${nav}</nav>
    <div class="top-actions">
      <a class="search-trigger" href="${u('/search/')}" data-palette aria-label="${esc(t('Search clients and tools'))}" aria-keyshortcuts="Control+K Meta+K">${ICONS.search}<span class="st-label">${th('Search')}</span><kbd class="st-kbd" aria-hidden="true" data-k="⌘K"></kbd></a>
      ${shareable ? `<button class="icon-btn" type="button" popovertarget="share" data-share data-tip="${esc(t('Share this page'))}" aria-label="${esc(t('Share this page'))}">${ICONS.share}</button>` : ''}
      <a class="icon-btn hide-xs" href="${REPO}" data-tip="${esc(t('Source on GitHub'))}">${ICONS.github}<span class="sr">${th('GitHub repository')}</span></a>
      <button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="${esc(t('Color theme: system'))}" data-tip="${esc(t('Theme: follows your system'))}">
        <span class="ti ti-system">${ICONS.system}</span><span class="ti ti-light">${ICONS.light}</span><span class="ti ti-dark">${ICONS.dark}</span>
      </button>
      <details class="menu">
        <summary class="icon-btn" aria-label="${esc(t('Menu'))}">${ICONS.menu}</summary>
        <nav class="nav-mobile" aria-label="${esc(t('Main'))}">${nav}</nav>
      </details>
    </div>
  </div>
</header>
<main id="main" class="wrap">
${body}
</main>
${shareable ? shareBox(url, share || title || `${site.title}: ${site.tagline}`) : ''}
<footer class="foot">
  <div class="wrap foot-grid">
    <div>
      <p class="brand-sm">${logo(22)} ${esc(site.title)}</p>
      <p>${th(site.tagline)}</p>
      <p>${th(site.disclosure)}</p>
      <p><a href="${u('/about/')}">${th('How the list is made')}</a> · <a href="${u('/about/')}#contact-and-corrections">${th('Contact')}</a></p>
    </div>
    <nav aria-label="${esc(t('Systems'))}">
      <h2 class="foot-h">${th('Systems')}</h2>
      <ul>${systems.map((s) => `<li><a href="${u(s.path)}">${esc(s.name)}</a></li>`).join('')}</ul>
    </nav>
    <nav aria-label="${esc(t('Explore'))}">
      <h2 class="foot-h">${th('Explore')}</h2>
      <ul><li><a href="${u('/best/')}">${th('Best clients by need')}</a></li><li><a href="${u('/clients/')}">${th('All clients')}</a></li><li><a href="${u('/tools/')}">${th('Mail tools')}</a></li><li><a href="${u('/compare/')}">${th('Comparisons')}</a></li><li><a href="${u('/alternatives/')}">${th('Alternatives')}</a></li><li><a href="${u('/features/')}">${th('By feature')}</a></li><li><a href="${u('/setup/')}">${th('Forward Email setup')}</a></li><li><a href="${u('/faq/')}">${th('Questions and answers')}</a></li><li><a href="${u('/glossary/')}">${th('Glossary')}</a></li></ul>
    </nav>
    <nav aria-label="${esc(t('Project'))}">
      <h2 class="foot-h">${th('Project')}</h2>
      <ul><li><a href="${REPO}">GitHub</a></li><li><a href="${REPO}/issues/new?template=suggest.yml">${th('Suggest a client')}</a></li><li><a href="${REPO}/issues/new?template=correction.yml">${th('Report a mistake')}</a></li><li><a href="${u('/contribute/')}">${th('Contribute')}</a></li><li><a href="${u('/privacy/')}">${th('Privacy policy')}</a></li><li><a href="${u('/terms/')}">${th('Terms of use')}</a></li><li><a href="${BASE}/api/clients.json">${th('JSON API')}</a></li><li><a href="${BASE}/llms.txt">llms.txt</a></li><li><a href="${BASE}/feed.xml">${th('Atom feed')}</a></li><li><a href="${BASE}/sitemap.xml">${th('Sitemap')}</a></li></ul>
    </nav>
  </div>
  <div class="wrap foot-legal">
    <p>${th('Facts are checked against each project\'s own website, repository and package listings, and each page links to its sources. Anyone can {correction}.', { correction: `<a href="${REPO}/issues/new?template=correction.yml">${th('report a mistake')}</a>` })}</p>
    <p>${th('Content {content}. Code {code}. No trackers, cookies, ads or affiliate links.', { content: '<a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license">CC BY-SA 4.0</a>', code: `<a href="${REPO}/blob/${site.branch}/LICENSE">MIT License</a>` })}</p>
  </div>
</footer>
<script src="${BASE}/app.js" defer></script>
</body>
</html>
`;
}

module.exports = { fit, esc, md, httpUrl, clip, u, abs, CSP, THEME_SCRIPT, ogJobs, layout, logo, ICONS, osMatrix, osKey, supportSentence, cell, cellText, tags, listing, osChips, filterRow, cmdLine, codeBlock, installTabs, ext, hostname, licenseText, licenseHtml, joinList, osName, plural, softwareLd, breadcrumbs, itemList, faqLd, ORG, website, filterText, headingSlug };
