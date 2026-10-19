'use strict';

// One function per kind of page. Text that depends on the data (counts, lists of names,
// differences between two clients) is computed here, so it never goes out of date.

const ctx = require('./context');
const lib = require('./lib');
const T = require('./templates');
const { t, th } = require('./i18n');

const { site, REPO, entries, clients, tools, featured, systems, comparisons, comparisonFor, bySlug, alternatives, features, pages, DOCS, FE_SETTINGS, has, newest, lastmod } = ctx;
const { OSES, SUPPORT, INTERFACES, TYPES, PROTOCOLS, FEATURES } = lib;
const { fit, esc, md, u, abs, layout, osMatrix, osKey, cell, tags, listing, osChips, filterRow, cmdLine, codeBlock, installTabs, ext, licenseText, licenseHtml, joinList, osName, plural, softwareLd, breadcrumbs, itemList, faqLd, supportSentence } = T;

const names = (list) => list.map((e) => e.name);
const linkNames = (list) => joinList(list.map((e) => `<a href="${u(e.path)}">${esc(e.name)}</a>`));
const maintainedClients = clients.filter((c) => c.maintained);
const nativeOn = (os, list = clients) => list.filter((c) => c.platforms[os].support === 'native');
// The clients that need WSL, or are not available, on Windows, as a sentence.
function winRest() {
  const by = (k) => clients.filter((c) => c.platforms.windows.support === k);
  const parts = [];
  if (by('wsl').length) parts.push(`${plural(by('wsl').length, 'other client runs', 'other clients run')} in Windows Subsystem for Linux (WSL).`);
  if (by('source').length) parts.push(`${linkNames(by('source'))} ${by('source').length === 1 ? 'builds' : 'build'} from source.`);
  if (by('none').length) parts.push(`${linkNames(by('none'))} ${by('none').length === 1 ? 'is' : 'are'} not available for Windows.`);
  return parts.join(' ');
}

// "Of the 19 clients on this site, 11 are full-screen (TUI), 4 are command-line and 4 run inside Emacs."
const IFACE_PHRASE = { tui: 'are full-screen (TUI)', cli: 'are command-line', emacs: 'run inside Emacs', vim: 'run inside Vim' };
function interfaceCounts(list = clients) {
  const parts = Object.keys(IFACE_PHRASE).map((k) => [k, list.filter((c) => c.interface === k).length]).filter(([, n]) => n);
  return `Of the ${plural(list.length, 'client', 'clients')} on this site, ${joinList(parts.map(([k, n]) => `${n} ${IFACE_PHRASE[k]}`))}.`;
}
// Clients with no built-in IMAP or POP3: they read local folders that a sync tool fills.
const maildirOnly = () => clients.filter((c) => c.protocols.imap !== true && c.protocols.pop3 !== true && !c.backend && (c.protocols.maildir === true || c.protocols.mbox === true));

function faqBlock(qa, { id = 'questions', title = 'Questions' } = {}) {
  return `<section class="faq" aria-labelledby="${id}"><h2 id="${id}">${th(title)}</h2>${qa.map(([q, a]) => `<details><summary><h3>${esc(q)}</h3></summary><div class="answer"><p>${a}</p></div></details>`).join('')}</section>`;
}

function settingsTable() {
  return `<div class="table-scroll" tabindex="0"><table class="matrix settings-table"><caption class="sr">${th('Forward Email server settings')}</caption><thead><tr><th scope="col">${th('Protocol')}</th><th scope="col">${th('Server')}</th><th scope="col">${th('Port')}</th><th scope="col">${th('Security')}</th></tr></thead><tbody>${FE_SETTINGS.map(([p, h, port, sec]) => `<tr><th scope="row">${esc(p)}</th><td><code>${esc(h)}</code></td><td>${esc(port)}</td><td>${esc(sec)}</td></tr>`).join('')}</tbody></table></div>
<p class="muted small">${th('Username: your full alias address, such as you@example.com. Password: the one shown by Generate Password next to the alias in your Forward Email account. Folders: INBOX, Drafts, Sent Mail, Trash, Spam and Archive.')}</p>`;
}

// ---------- screenshots ----------

function gallery(e, { idp = 'shots', first = 0, sizes = ENTRY_SIZES, eager = true } = {}) {
  const shots = e.screenshots || [];
  if (!shots.length) return '';
  const src = (theme, s, size = '') => u(`/screenshots/${e.slug}/${theme}-${s.name}${size}.webp`);
  const img = (s, i) => {
    // The first screenshot can be the largest paint. On client pages the dark one loads first with
    // high priority, and the head preloads whichever theme is showing; on the home page, where the
    // shot sits beside the text, neither theme waits for lazy loading.
    const load = (theme) => (i !== 0 ? 'loading="lazy"' : !eager ? '' : theme === 'dark' ? 'fetchpriority="high"' : 'loading="lazy"');
    const set = (theme) => `src="${src(theme, s)}" srcset="${src(theme, s, '-720')} 720w, ${src(theme, s)} 1440w" sizes="${sizes}"`;
    // Short alt text: the caption under the image has the full description.
    const alt = esc(`${e.name}: ${s.name} screen`);
    return `<img class="shot shot-dark" ${set('dark')} width="1440" height="960" alt="${alt}" ${load('dark')} decoding="async"><img class="shot shot-light" ${set('light')} width="1440" height="960" alt="${alt}" ${load('light')} decoding="async">`;
  };
  const label = (s) => s.name.charAt(0).toUpperCase() + s.name.slice(1);
  const order = [...shots.slice(first), ...shots.slice(0, first)];
  return `<div class="term"><div class="term-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="term-title">${esc(`~ $ ${e.slug === 'forward-email' ? 'forwardemail' : e.slug} --demo`)}</span></div>
<div class="gallery" data-gallery id="${idp}">${order.map((s, i) => `<div class="shot-panel${i === 0 ? ' on' : ''}" id="${idp}-${s.name}" role="tabpanel" aria-labelledby="${idp}-tab-${s.name}"><figure>${img(s, i)}<figcaption>${esc(s.alt)}</figcaption></figure></div>`).join('')}</div></div>
<ul class="gallery-tabs" role="tablist" aria-label="${esc(t('Screenshots'))}" data-gallery-tabs="${idp}">${order.map((s, i) => `<li role="presentation"><button type="button" role="tab" id="${idp}-tab-${s.name}" aria-controls="${idp}-${s.name}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(label(s))}</button></li>`).join('')}</ul>`;
}

const ENTRY_SIZES = '(min-width: 1200px) 1160px, calc(100vw - 34px)';
const HERO_SIZES = '(min-width: 1200px) 620px, (min-width: 980px) 52vw, calc(100vw - 34px)';
// The first screenshot, as a srcset matching the <img>, so the browser preloads the file it will use.
const firstShot = (e, sizes = ENTRY_SIZES) => {
  const set = (theme) => ['-720 720w', ' 1440w'].map((x) => { const [suffix, w] = x.split(' '); return `${u(`/screenshots/${e.slug}/${theme}-${e.screenshots[0].name}${suffix.trim()}.webp`)} ${w}`; }).join(', ');
  return { dark: set('dark'), light: set('light'), sizes };
};

// ---------- home ----------

function homeFaq() {
  const winNative = nativeOn('windows').filter((c) => c.maintained);
  const oauth = clients.filter((c) => has(c.features.oauth2));
  const oauthBuiltIn = clients.filter((c) => c.features.oauth2 === true);
  const jmap = clients.filter((c) => c.protocols.jmap === true);
  const mouse = clients.filter((c) => c.features.mouse === true);
  const notOss = clients.filter((c) => !c.openSource);
  const images = clients.filter((c) => /inline images/.test(String(c.features.html)));
  return [
    ['What is a terminal email client?', `A program that reads and sends email inside a terminal window, with text instead of graphics. Full-screen ones (TUIs) such as <a href="${u('/clients/neomutt/')}">NeoMutt</a>, <a href="${u('/clients/aerc/')}">aerc</a> and <a href="${u('/clients/forward-email/')}">Forward Email</a> work like an app inside the terminal. Command-line ones such as <a href="${u('/clients/himalaya/')}">Himalaya</a> and <a href="${u('/clients/s-nail/')}">s-nail</a> are commands you run and script.`],
    ['Which terminal email clients run natively on Windows?', `${linkNames(winNative)} run directly on Windows. ${winRest()} See <a href="${u('/windows/')}">terminal email on Windows</a>.`],
    ['Can I use Gmail or Outlook?', `Yes, over IMAP and SMTP. Google and Microsoft require OAuth2 sign-in for most accounts: ${linkNames(oauthBuiltIn)} handle it themselves, and ${linkNames(oauth.filter((c) => c.features.oauth2 !== true))} need extra setup, such as a token helper script or an Emacs package.`],
    ['Can terminal clients show HTML email?', `Most show the plain-text part of a message and pass HTML to a text browser such as w3m or lynx, which turns it into readable text with numbered links. Most do not draw images${images.length ? `; ${linkNames(images)} can show inline images in terminals that support an image protocol` : ''}. Most clients can open a message in a graphical browser when needed.`],
    ['Which clients support JMAP?', `${linkNames(jmap)} ${jmap.length === 1 ? 'supports' : 'support'} JMAP, the JSON protocol some providers offer instead of IMAP. The other clients use IMAP, POP3 or local folders, and Forward Email's app uses Forward Email's own API.`],
    ['Which clients work with a mouse?', `${linkNames(mouse)} respond to clicks and scrolling. The others are keyboard-only.`],
    ['Are they open source?', `All of them except ${linkNames(notOss)}, whose code is public under the ${notOss.map(licenseText).join(', ')}, a source-available license. Each page links to the project's repository and license.`],
    ['How do I use a terminal client with Forward Email?', `Point the client at <code>imap.forwardemail.net</code> (port 993) and <code>smtp.forwardemail.net</code> (port 465), with your alias address as the username and a generated password. Every client page has a ready-made config, and <a href="${u('/setup/')}">the setup page</a> collects them all. Forward Email's own terminal app needs no config: run <code>forwardemail</code> and sign in.`]
  ];
}

function homePage() {
  const fe = featured;
  const qa = homeFaq();
  const body = `<section class="hero" aria-labelledby="h1">
<div class="hero-grid">
<div class="hero-copy">
<p class="prompt" aria-hidden="true">~ <b>$</b> terminalemail --list --os=any</p>
<h1 id="h1">Terminal email clients for every system<span class="cursor" aria-hidden="true"></span></h1>
<p class="lede">Read and send email from a terminal on Linux, macOS, Windows, BSD and Android. ${plural(maintainedClients.length, 'maintained client', 'maintained clients')} and ${plural(tools.length, 'mail tool', 'mail tools')}, each with install commands for every system and a config that works with Forward Email or any other provider.</p>
<p class="lede-sub">The screenshots show <a href="${u(fe.path)}">Forward Email</a>'s terminal app, made by the team behind this site. It is the only client here with its own calendar, contact list and task list, alongside mail.</p>
<p class="links-row"><a class="btn btn-primary" href="#clients">${th('Browse clients')}</a><a class="btn" href="${u(fe.path)}">${th('Install Forward Email')}</a></p>
</div>
<div class="hero-shot">${gallery(fe, { idp: 'hero', sizes: HERO_SIZES, eager: false })}</div>
</div>
</section>

<section class="featured" aria-labelledby="fe-h">
<div class="featured-copy">
<div class="featured-head"><h2 id="fe-h">forwardemail</h2><span class="tag tag-featured">${th('Featured')}</span></div>
<p>${esc(fe.description)}</p>
<ul class="featured-list">${fe.pros.map((p) => `<li>${esc(p)}</li>`).join('')}<li>Works with self-hosted Forward Email through <code>--api</code></li></ul>
<p class="muted small">${esc(fe.account.replace(/`/g, ''))}</p>
</div>
<div>
<h3>Install</h3>
${installTabs(fe, { idp: 'home-inst' })}
<p class="links-row"><a class="btn" href="${u(fe.path)}">${th('All features and screenshots')}</a><a class="btn btn-quiet" href="${u('/setup/')}">${th('Use another client with Forward Email')}</a></p>
</div>
</section>

<section id="clients" aria-labelledby="clients-h">
<h2 id="clients-h">Clients</h2>
<p class="measure">${interfaceCounts()} ${plural(nativeOn('windows').length, 'runs', 'run')} natively on Windows. Pick a system to see what runs there, filter by name, language or protocol, or start with <a href="${u('/best/')}">the best picks by need</a>.</p>
${osChips()}
${filterRow()}
${osKey()}
${listing(clients, { caption: `${clients.length} email clients`, id: 'client-table', empty: 'No client matches. Clear the filter or pick another system.' })}
</section>

<section id="tools" aria-labelledby="tools-h">
<h2 id="tools-h">Mail tools</h2>
<p class="measure">${plural(tools.length, 'program syncs', 'programs sync')}, send, fetch or index mail for the clients above. ${plural(maildirOnly().length, 'client reads', 'clients read')} only local folders, such as ${linkNames(maildirOnly().slice(0, 2))}, and ${maildirOnly().length === 1 ? 'needs' : 'need'} a sync tool like isync; many clients send through msmtp.</p>
${listing(tools, { caption: `${tools.length} mail tools`, id: 'tool-table' })}
</section>

<section aria-labelledby="sys-h">
<h2 id="sys-h">By system</h2>
<p class="measure">${joinList(systems.map((s) => `${s.clients.length} ${s.id === 'linux' ? `of the ${clients.length} clients run` : 'run'} on ${esc(s.name)}${s.id === 'android' ? ' through Termux' : s.native.length < s.clients.length ? ` (${s.native.length} natively)` : ''}`))}.</p>
${systemsGrid()}
</section>

<section aria-labelledby="feat-h">
<h2 id="feat-h">By feature</h2>
<p class="measure">${features.length} lists of clients that share a feature, from ${features.find((f) => f.slug === 'open-source') ? `${features.find((f) => f.slug === 'open-source').list.length} open-source clients` : 'open-source clients'} to ${features.find((f) => f.slug === 'jmap') ? `${features.find((f) => f.slug === 'jmap').list.length} with JMAP` : 'JMAP'}. Terms such as Maildir, JMAP and OAuth2 are explained in <a href="${u('/glossary/')}">the glossary</a>.</p>
<ul class="link-list">${features.map((f) => `<li><a href="${u(f.path)}">${esc(f.h1)}</a> <span class="muted">(${f.list.length})</span></li>`).join('')}</ul>
</section>

${faqBlock(qa)}
<p><a href="${u('/faq/')}">${th('More questions and answers')}</a></p>`;
  return layout({
    title: null,
    description: `${maintainedClients.length} terminal email clients for Linux, macOS, Windows, BSD and Android, compared by protocols, features and install commands.`,
    body,
    pathname: '/',
    jsonld: [{ '@type': 'CollectionPage', '@id': `${abs('/')}#page`, name: site.title, url: abs('/'), description: site.tagline, isPartOf: { '@id': `${abs('/')}#website` }, mainEntity: itemList('Terminal email clients', clients) }, softwareLd(fe), faqLd(qa.map(([q, a]) => [q, a]))],
    lastmod: newest(entries),
    og: { kind: 'home', title: 'Terminal email clients for every system', clients, alt: `Terminal Email: ${clients.length} terminal email clients for Linux, macOS, Windows, BSD and Android.` },
    preloadShot: { ...firstShot(fe, HERO_SIZES), wide: true }
  });
}

function systemsGrid() {
  return `<ul class="systems">${systems.map((s) => `<li><a href="${u(s.path)}"><span class="sys-name">${esc(s.name)}</span><span class="sys-n">${plural(s.clients.length, 'client', 'clients')}${s.id === 'android' ? ' through Termux' : s.native.length < s.clients.length ? `, ${s.native.length} native` : ''}</span></a></li>`).join('')}</ul>`;
}

// ---------- client and tool pages ----------

function platformRows(e) {
  return OSES.map((o) => {
    const p = e.platforms[o.id];
    const steps = p.install?.length ? p.install.map((s) => cmdLine(s.cmd, s.via)).join('') : '';
    return `<tr><th scope="row"><a href="${u(`/${o.id}/`)}">${esc(o.name)}</a></th><td>${p.support === 'none' ? '<span class="no">Not supported</span>' : p.support === 'native' ? '<span class="yes">Native</span>' : `<span class="part">${esc(SUPPORT[p.support].label)}</span>`}</td><td>${steps}${p.note ? `<p class="muted small">${esc(p.note)}</p>` : ''}${!steps && !p.note ? '<span class="muted">-</span>' : ''}</td></tr>`;
  }).join('');
}

function protocolRows(e) {
  if (e.backend) return `<tr><th scope="row">${th('Connects through')}</th><td>${esc(e.backend)}</td></tr><tr><th scope="row">${th('Accounts')}</th><td>${esc(e.account.replace(/`/g, ''))}</td></tr>`;
  return PROTOCOLS.map(([k, n]) => `<tr><th scope="row">${esc(n)}</th><td>${cell(e.protocols[k])}</td></tr>`).join('');
}
const featureRows = (e) => FEATURES.map(([k, n]) => `<tr><th scope="row">${esc(n)}</th><td>${cell(e.features[k])}</td></tr>`).join('');

function entryFaq(e) {
  const win = e.platforms.windows;
  const winA = win.support === 'native' ? `Yes, it runs natively on Windows.${win.note ? ` ${win.note}` : ''}` : win.support === 'wsl' ? `Not natively. It runs in Windows Subsystem for Linux (WSL).${win.note ? ` ${win.note}` : ''}` : win.support === 'source' ? `Only if you build it from source.${win.note ? ` ${win.note}` : ''}` : `No.${win.note ? ` ${win.note}` : ''} See <a href="${u('/windows/')}">clients that run on Windows</a>.`;
  const imapA = e.backend
    ? `No. It connects to Forward Email over its API. For IMAP, use another client on this site with <a href="${u('/setup/')}">Forward Email's IMAP settings</a>.`
    : e.protocols.imap === true
      ? `Yes, ${esc(e.name)} connects to IMAP servers directly.`
      : e.protocols.imap === 'external'
        ? `Through a separate tool. ${esc(e.name)} reads local mail, so a sync program such as <a href="${u('/tools/isync/')}">isync</a> copies it from the IMAP server.`
        : `No. ${esc(e.name)} does not use IMAP.`;
  const ossA = e.openSource ? `Yes, under the ${licenseHtml(e)}.` : `Its source code is public under the ${licenseHtml(e)}, which is source-available rather than open source.`;
  const qa = [
    [`Does ${e.name} work on Windows?`, winA],
    [`Does ${e.name} support IMAP?`, imapA],
    [`Is ${e.name} open source?`, ossA]
  ];
  if (e.featured) qa.push([`Do I need a Forward Email account?`, `Yes, to read your own mail. ${esc(e.account.replace(/`/g, ''))}`]);
  else qa.push([`How do I use ${e.name} with Forward Email?`, `Use the config in the <a href="#forward-email">Forward Email section</a> on this page${e.forward_email_file ? `, saved as <code>${esc(e.forward_email_file)}</code>` : ''}, and replace the address and password with your own.`]);
  return qa;
}

function entryPage(e) {
  const crumbs = [['Home', '/'], [e.type === 'tool' ? 'Mail tools' : 'Clients', e.type === 'tool' ? '/tools/' : '/clients/'], [e.name, e.path]];
  const similar = e.type === 'client' ? alternatives.find((a) => a.entry.slug === e.slug).list.slice(0, 6) : [];
  const qa = entryFaq(e);
  const facts = [
    ['Type', esc(TYPES[e.type])],
    ['Interface', esc(INTERFACES[e.interface].long)],
    ['Systems', esc(supportSentence(e))],
    ['Language', esc(e.language)],
    ['License', licenseHtml(e)],
    e.latest_version ? ['Latest version', `<code>${esc(e.latest_version)}</code>`] : null,
    e.lineage ? ['Background', esc(e.lineage)] : null,
    ['Maintained', e.maintained ? 'Yes' : 'No recent commits or releases'],
    e.website ? ['Website', ext(e.website, e.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))] : null,
    e.repo ? ['Source', ext(e.repo, e.repo.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))] : null,
    e.docs ? ['Documentation', ext(e.docs, e.docs.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))] : null
  ].filter(Boolean);
  const feSection = e.featured
    ? `<section id="forward-email" aria-labelledby="fe-h"><h2 id="fe-h">Install and run</h2>${codeBlock(e.forward_email, { title: 'Terminal' })}<p class="muted small">${esc(e.account.replace(/`/g, ''))} To use Forward Email in a different client, see <a href="${u('/setup/')}">the setup page</a>.</p></section>`
    : `<section id="forward-email" aria-labelledby="fe-h"><h2 id="fe-h">Use ${esc(e.name)} with Forward Email</h2>
<p class="measure">${e.type === 'tool' ? `How ${esc(e.name)} fits with a Forward Email mailbox.` : `A working setup for a Forward Email mailbox.`} Replace <code>you@example.com</code> with your alias and the password command with your own. The same settings work with any provider once the server names change.</p>
${codeBlock(e.forward_email, { title: e.forward_email_file || 'Configuration' })}
${settingsTable()}
<p class="note">Prefer no config at all? <a href="${u(featured.path)}">Forward Email's terminal app</a> signs in with your account and has mail, calendar and contacts in one program.</p>
</section>`;
  const body = `<nav aria-label="${esc(t('Breadcrumb'))}"><ol class="crumbs">${crumbs.slice(0, -1).map(([n, p]) => `<li><a href="${u(p)}">${esc(n)}</a></li>`).join('')}<li aria-current="page">${esc(e.name)}</li></ol></nav>
<article>
<header class="entry-head">
<h1>${esc(e.name)}</h1>
<p class="tags">${tags(e, { type: true })}</p>
<p class="lede">${esc(e.summary)}</p>
</header>
${e.screenshots?.length ? gallery(e, { idp: 'shots' }) : ''}
<p class="measure">${esc(e.description)}</p>
<dl class="facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>

<section aria-labelledby="install-h"><h2 id="install-h">Install</h2>
<div class="table-scroll" tabindex="0"><table class="matrix"><caption class="sr">${th('{name} on each system', { name: esc(e.name) })}</caption><thead><tr><th scope="col">${th('System')}</th><th scope="col">${th('Support')}</th><th scope="col">${th('Install')}</th></tr></thead><tbody>${platformRows(e)}</tbody></table></div>
</section>

<section aria-labelledby="pf-h"><h2 id="pf-h">Protocols and features</h2>
<div class="grid-2">
<div class="table-scroll" tabindex="0"><table class="matrix"><caption class="sr">Protocols</caption><thead><tr><th scope="col">${th('Protocol')}</th><th scope="col">${esc(e.name)}</th></tr></thead><tbody>${protocolRows(e)}</tbody></table></div>
<div class="table-scroll" tabindex="0"><table class="matrix"><caption class="sr">Features</caption><thead><tr><th scope="col">${th('Feature')}</th><th scope="col">${esc(e.name)}</th></tr></thead><tbody>${featureRows(e)}</tbody></table></div>
</div>
</section>

<section aria-labelledby="pc-h"><h2 id="pc-h">Pros and cons</h2>
<div class="grid-2"><div><h3>Pros</h3><ul class="pros">${e.pros.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div><div><h3>Cons</h3><ul class="cons">${e.cons.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div></div>
</section>

${feSection}

${similar.length ? `<section aria-labelledby="cmp-h"><h2 id="cmp-h">Compare ${esc(e.name)}</h2><ul class="link-list">${similar.map((o) => `<li><a href="${u(comparisonFor(e, o).path)}">${esc(e.name)} vs ${esc(o.name)}</a></li>`).join('')}</ul><p><a href="${u(`/alternatives/${e.slug}/`)}">${th('All {name} alternatives', { name: esc(e.name) })}</a></p></section>` : ''}

${faqBlock(qa)}

<section aria-labelledby="src-h"><h2 id="src-h">Sources</h2><ul class="sources">${e.sources.map((s) => `<li>${ext(s, s.replace(/^https?:\/\/(www\.)?/, ''))}</li>`).join('')}</ul>
<p class="links-row small"><a href="${REPO}/blob/${site.branch}/${esc(e.file)}">${th('Edit this page on GitHub')}</a><a href="${REPO}/issues/new?${esc(new URLSearchParams({ template: 'correction.yml', title: `Correction: ${e.name}` }).toString())}">${th('Report a mistake on this page')}</a></p>
</section>
</article>`;
  return layout({
    title: e.featured ? `${e.name} terminal app: install and features` : fit(60, `${e.name}: ${e.type === 'tool' ? 'mail tool' : 'terminal email client'}, install and setup`, `${e.name}: ${e.type === 'tool' ? 'mail tool' : 'email client'}, install and setup`, `${e.name}: install and setup`),
    // The longest ending that still fits in 150 characters after the summary.
    description: [' Install commands for each system, protocols, features and a Forward Email config.', ' Install commands, features and a working config.', ' Install and setup.', ''].map((end) => `${e.summary}${end}`).find((d) => [...d].length <= 150) || e.summary,
    body,
    pathname: e.path,
    type: 'article',
    jsonld: [softwareLd(e), breadcrumbs(crumbs), faqLd(qa)],
    lastmod: e.lastmod,
    share: `${e.name}: ${e.summary}`,
    og: { kind: 'entry', entry: e, title: e.name, alt: `${e.name}: ${e.summary}` },
    preloadShot: e.screenshots?.length ? firstShot(e) : null
  });
}

// ---------- index pages ----------

function clientsIndex() {
  const body = `<h1>Terminal email clients</h1>
<p class="lede">All ${clients.length} clients, with the systems each runs on. ${maintainedClients.length} are maintained.</p>
${osChips(null, { any: '/clients/' })}
${filterRow()}
${osKey()}
${listing(clients, { caption: `${clients.length} email clients`, id: 'client-table', empty: 'No client matches. Clear the filter or pick another system.' })}
<h2>By feature</h2>
<ul class="link-list">${features.map((f) => `<li><a href="${u(f.path)}">${esc(f.h1)}</a> <span class="muted">(${f.list.length})</span></li>`).join('')}</ul>
<h2>By system</h2>
${systemsGrid()}`;
  return layout({ title: 'All terminal email clients', description: `${clients.length} terminal email clients compared: NeoMutt, aerc, meli, Alpine, Himalaya, Forward Email and more, with the systems each runs on.`, body, pathname: '/clients/', jsonld: [{ '@type': 'CollectionPage', name: 'Terminal email clients', url: abs('/clients/'), mainEntity: itemList('Terminal email clients', clients) }, breadcrumbs([['Home', '/'], ['Clients', '/clients/']])], lastmod: newest(clients), og: { kind: 'list', title: 'All terminal email clients', list: clients } });
}

function toolsIndex() {
  const body = `<h1>Mail tools</h1>
<p class="lede">Programs that sync, send, fetch or index mail for terminal clients.</p>
<ul class="measure">
<li><strong>Sync:</strong> <a href="${u('/tools/isync/')}">isync</a> and <a href="${u('/tools/offlineimap/')}">OfflineIMAP</a> keep an IMAP server and local Maildir folders in step, in both directions, so clients like alot, mu4e and mblaze can read mail offline.</li>
<li><strong>Fetch:</strong> <a href="${u('/tools/getmail6/')}">getmail6</a> downloads new mail over POP3 or IMAP into Maildir or mbox.</li>
<li><strong>Send:</strong> <a href="${u('/tools/msmtp/')}">msmtp</a> hands outgoing mail to an SMTP server for clients that only write files or call sendmail.</li>
<li><strong>Index and search:</strong> <a href="${u('/tools/notmuch/')}">notmuch</a> tags and searches a local mail store.</li>
<li><strong>Set up:</strong> <a href="${u('/tools/mutt-wizard/')}">mutt-wizard</a> writes the NeoMutt, isync and msmtp configs for an account.</li>
</ul>
${osKey()}
${listing(tools, { caption: `${tools.length} mail tools` })}`;
  return layout({ title: 'Terminal mail tools: sync, send and search', description: `${tools.length} mail tools for terminal email: isync (mbsync), OfflineIMAP, getmail6, msmtp, notmuch and more, to sync, send and index mail.`, body, pathname: '/tools/', jsonld: [{ '@type': 'CollectionPage', name: 'Mail tools', url: abs('/tools/'), mainEntity: itemList('Mail tools', tools) }, breadcrumbs([['Home', '/'], ['Mail tools', '/tools/']])], lastmod: newest(tools), og: { kind: 'list', title: 'Mail tools for the terminal', list: tools } });
}

// "17 clients run on Windows: 5 natively and 12 through WSL. 6 mail tools run there too."
function systemSummary(s) {
  const by = Object.keys(SUPPORT).filter((k) => SUPPORT[k].ok).map((k) => [k, s.clients.filter((c) => c.platforms[s.id].support === k).length]).filter(([, n]) => n);
  const how = { native: 'natively', wsl: 'through WSL', termux: 'through Termux', source: 'built from source' };
  return `${plural(s.clients.length, 'client runs', 'clients run')} on ${esc(s.name)}: ${joinList(by.map(([k, n]) => `${n} ${how[k]}`))}. ${plural(s.tools.length, 'mail tool runs', 'mail tools run')} there too.`;
}

function systemsIndex() {
  const body = `<h1>Terminal email by system</h1>
<p class="lede">All ${clients.length} clients run on Linux. The other systems differ: pick yours for install commands and what runs natively.</p>
${systemsGrid()}
${systems.map((s) => `<h2 id="${s.id}-h"><a href="${u(s.path)}">${esc(s.name)}</a></h2><p class="measure">${esc(s.blurb)}. ${systemSummary(s)}</p>`).join('\n')}
<h2>${th('Every client on every system')}</h2>
<p class="measure">${th('Native means a package or build for the system itself. WSL and Termux run Linux programs on Windows and Android. Source means the program compiles there but has no package.')}</p>
<div class="table-scroll" tabindex="0"><table class="matrix"><caption class="sr">${th('Support for each client on each system')}</caption><thead><tr><th scope="col">${th('Client')}</th>${OSES.map((o) => `<th scope="col">${esc(o.name)}</th>`).join('')}</tr></thead><tbody>${clients.map((c) => `<tr><th scope="row"><a href="${u(c.path)}">${esc(c.name)}</a></th>${OSES.map((o) => { const s = c.platforms[o.id].support; return `<td>${s === 'none' ? '<span class="no">No</span>' : s === 'native' ? '<span class="yes">Native</span>' : `<span class="part">${esc(SUPPORT[s].short)}</span>`}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  return layout({ title: 'Terminal email clients by operating system', description: `Which of the ${clients.length} terminal email clients run on Linux, macOS, Windows, BSD and Android, natively or through WSL and Termux, with install commands.`, body, pathname: '/systems/', jsonld: [breadcrumbs([['Home', '/'], ['Systems', '/systems/']])], lastmod: newest(entries), og: { kind: 'page', title: 'Terminal email by operating system', text: 'Linux, macOS, Windows, BSD and Android' } });
}

// ---------- system pages ----------

const OS_TEXT = {
  linux: () => `Every client on this site runs on Linux${(() => { const src = clients.filter((c) => c.platforms.linux.support === 'source'); return src.length ? ` (${joinList(src.map((c) => esc(c.name)))} ${src.length === 1 ? 'builds' : 'build'} from source)` : ''; })()}, and most are in the main repositories of Debian, Ubuntu, Fedora and Arch. Install with your distribution's package manager, then add a config file for your mail provider. The table shows the first command each project lists; each client's page has the commands for other distributions.`,
  macos: () => {
    const brew = clients.filter((c) => c.platforms.macos.install?.some((s) => /homebrew/i.test(s.via)));
    const mac = systems.find((s) => s.id === 'macos').clients;
    const others = [...new Set(mac.filter((c) => !brew.includes(c)).map((c) => (c.platforms.macos.install?.[0]?.via || 'source').replace(/^install script$/, 'an install script')))];
    return `Most clients install with <a href="https://brew.sh/" rel="noopener">Homebrew</a>: ${brew.length} of the ${mac.length} that run on macOS have a Homebrew formula or cask.${others.length ? ` The rest install with ${joinList(others.map(esc))}, and each client's page has the command.` : ''}`;
  },
  windows: () => {
    const native = nativeOn('windows');
    return `${linkNames(native)} run natively on Windows. ${winRest()} WSL runs a real Linux system next to Windows: run <code>wsl --install</code> in an administrator PowerShell, restart, open Ubuntu from the Start menu and install the client with <code>apt</code>. Use Windows Terminal rather than the legacy console, for correct colors and box-drawing characters.`;
  },
  bsd: () => `FreeBSD packages most clients (<code>pkg install</code>), and OpenBSD (<code>pkg_add</code>) and NetBSD (pkgsrc) package many of the same ones. A client listed as "build from source" compiles on BSD but has no package yet.`,
  android: () => `<a href="https://termux.dev/" rel="noopener">Termux</a> runs a Linux-style terminal on Android without root access. Install Termux from F-Droid or its GitHub releases, then install clients with <code>pkg install</code>. A Bluetooth or USB keyboard makes the full-screen clients much easier to use.`
};

function systemFaq(s) {
  const nat = s.native;
  const qa = [[`Which terminal email clients run on ${s.name}?`, `${plural(s.clients.length, 'client runs', 'clients run')} on ${esc(s.name)}${s.id === 'windows' ? ` (${nat.length} natively)` : s.id === 'android' ? ', all through Termux' : ''}: ${linkNames(s.clients)}.`]];
  if (s.id === 'windows') qa.push(['Do I need WSL?', `Only for clients without a native build. ${linkNames(nat)} install directly on Windows; the rest need WSL.`]);
  qa.push([`Which ${s.name} clients have built-in IMAP?`, `${linkNames(s.clients.filter((c) => c.protocols.imap === true))}. The others read local mail that a sync tool such as isync keeps up to date${s.clients.some((c) => c.backend) ? `, or, for Forward Email's app, connect through its API` : ''}.`]);
  qa.push([`Does Forward Email work on ${s.name}?`, `${featured.platforms[s.id].support === 'none' ? 'Its terminal app does not' : `Yes. Its terminal app ${s.id === 'android' ? 'runs in Termux through npm' : s.id === 'bsd' ? 'installs from npm' : 'has a standalone build'}`}, and every other client on this page can use a Forward Email mailbox over IMAP and SMTP, directly or through a sync tool.`]);
  return qa;
}

function systemPage(s) {
  const qa = systemFaq(s);
  const fe = featured;
  const fePlat = fe.platforms[s.id];
  const body = `<nav aria-label="${esc(t('Breadcrumb'))}"><ol class="crumbs"><li><a href="${u('/')}">Home</a></li><li><a href="${u('/systems/')}">Systems</a></li><li aria-current="page">${esc(s.name)}</li></ol></nav>
<h1>Terminal email clients for ${esc(s.name)}</h1>
<p class="lede">${plural(s.clients.length, 'client', 'clients')} and ${plural(s.tools.length, 'mail tool', 'mail tools')} that run on ${esc(s.name)}, with the install command for each.</p>
<p class="measure">${OS_TEXT[s.id]()}</p>
${osChips(s.id, { filter: false })}
${fePlat.support !== 'none' ? `<div class="featured"><div class="featured-copy"><div class="featured-head"><h2>forwardemail on ${esc(s.name)}</h2><span class="tag tag-featured">${th('Featured')}</span></div><p>${esc(fe.summary)}</p>${fePlat.note ? `<p class="muted small">${esc(fePlat.note)}</p>` : ''}<p><a href="${u(fe.path)}">${th('Screenshots and features')}</a></p></div><div>${(fePlat.install || []).map((x) => cmdLine(x.cmd, x.via)).join('')}</div></div>` : ''}
<h2>Clients</h2>
${filterRow()}
${listing(s.clients, { caption: `${s.clients.length} clients for ${s.name}`, os: s.id, id: 'client-table', empty: 'No client matches.' })}
${s.tools.length ? `<h2>Mail tools</h2>${listing(s.tools, { caption: `${s.tools.length} mail tools for ${s.name}`, os: s.id })}` : ''}
${faqBlock(qa)}`;
  return layout({
    title: `Terminal email clients for ${s.name}`,
    description: ((lead) => fit(155, `${lead} Protocols, features and a config for each.`, `${lead} Features and a config for each.`, lead))(`${s.clients.length} terminal email clients for ${s.name}${s.id === 'android' ? ' through Termux' : s.native.length < s.clients.length ? ` (${s.native.length} native)` : ''}, with install commands: ${names(s.clients.slice(0, 4)).join(', ')} and more.`),
    body,
    pathname: s.path,
    jsonld: [{ '@type': 'CollectionPage', name: `Terminal email clients for ${s.name}`, url: abs(s.path), mainEntity: itemList(`Terminal email clients for ${s.name}`, s.clients) }, breadcrumbs([['Home', '/'], ['Systems', '/systems/'], [s.name, s.path]]), faqLd(qa)],
    lastmod: newest(s.clients),
    og: { kind: 'list', title: `Terminal email clients for ${s.name}`, list: s.clients, os: s.id }
  });
}

// ---------- comparisons ----------

function differences(a, b) {
  const out = [];
  for (const [x, y] of [[a, b], [b, a]]) if (x.lineage && x.lineage.includes(y.name)) out.push(`${esc(x.name)}: ${esc(x.lineage)}.`);
  if (a.interface !== b.interface) out.push(`${esc(a.name)} is ${INTERFACES[a.interface].noun}; ${esc(b.name)} is ${INTERFACES[b.interface].noun}.`);
  const onlyProto = (x, y) => PROTOCOLS.filter(([k]) => x.protocols[k] === true && y.protocols[k] !== true && !y.backend).map(([, n]) => n);
  for (const [x, y] of [[a, b], [b, a]]) {
    const list = onlyProto(x, y);
    if (list.length && !x.backend) out.push(`Only ${esc(x.name)} has built-in ${joinList(list)}.`);
  }
  if (a.backend || b.backend) {
    const fe = a.backend ? a : b;
    const other = fe === a ? b : a;
    out.push(`${esc(fe.name)} connects to Forward Email accounts through its API; ${esc(other.name)} works with any provider${other.protocols.imap === true ? ' over IMAP' : ''}, including Forward Email.`);
  }
  for (const o of OSES) {
    const sa = a.platforms[o.id].support;
    const sb = b.platforms[o.id].support;
    if (sa === sb) continue;
    const say = (x, s) => `${esc(x.name)} ${SUPPORT[s].phrase}`;
    out.push(`On ${o.name}, ${say(a, sa)} and ${say(b, sb)}.`);
  }
  for (const [k, n] of [['mouse', 'mouse support'], ['calendar', 'calendar support'], ['pgp', 'OpenPGP'], ['smime', 'S/MIME'], ['oauth2', 'OAuth2 sign-in'], ['vim_keys', 'Vim-style keys'], ['multiple_accounts', 'multiple accounts'], ['threads', 'threaded views']]) {
    const ha = has(a.features[k]);
    const hb = has(b.features[k]);
    if (ha !== hb) out.push(`${esc((ha ? a : b).name)} has ${n}; ${esc((ha ? b : a).name)} does not.`);
  }
  if (a.language !== b.language) out.push(`${esc(a.name)} is written in ${esc(a.language)}; ${esc(b.name)} in ${esc(b.language)}.`);
  if (typeof a.features.config === 'string' && typeof b.features.config === 'string' && a.features.config !== b.features.config) out.push(`Configuration: ${esc(a.name)} uses ${esc(a.features.config)}, and ${esc(b.name)} uses ${esc(b.features.config)}.`);
  if (a.openSource !== b.openSource) {
    const sa = a.openSource ? b : a;
    out.push(`${esc(sa.name)} is source-available (${esc(licenseText(sa))}); ${esc((sa === a ? b : a).name)} is open source (${esc(licenseText(sa === a ? b : a))}).`);
  }
  if (a.maintained !== b.maintained) out.push(`${esc((a.maintained ? b : a).name)} has had no commits or releases in about a year.`);
  return out;
}

// As many differences as fit in a search result, then what the page has.
function compareDescription(a, b, diffs) {
  const plain = diffs
    .map((d) => d.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"))
    // "NeoMutt: Fork of Mutt." reads as "NeoMutt is a fork of Mutt." in a sentence.
    .map((d) => d.replace(/^([^:]+): (Fork|Successor|Rewrite|Continuation|Python 3 fork|Python 3 port) of /, (m, n, w) => `${n} is a ${w.toLowerCase()} of `));
  let text = `${a.name} vs ${b.name}:`;
  if (!plain.length) text += ' interface, protocols, features and the systems each runs on.';
  for (const d of plain) if ([...`${text} ${d} Side by side.`].length <= 155) text += ` ${d}`;
  return fit(155, `${text} Side by side, with install commands.`, `${text} Side by side.`, text);
}

function comparePage(c) {
  const { a, b } = c;
  const row = (label, fa, fb) => `<tr><th scope="row">${esc(label)}</th><td>${fa}</td><td>${fb}</td></tr>`;
  const supportCell = (e, os) => {
    const s = e.platforms[os].support;
    return s === 'none' ? '<span class="no">No</span>' : s === 'native' ? '<span class="yes">Native</span>' : `<span class="part">${esc(SUPPORT[s].label)}</span>`;
  };
  const protoCell = (e, k) => (e.backend ? '<span class="muted">Forward Email API</span>' : cell(e.protocols[k]));
  const diffs = differences(a, b);
  const qa = [
    [`What is the difference between ${a.name} and ${b.name}?`, diffs.slice(0, 3).join(' ') || 'They cover the same protocols and systems; the differences are in configuration and keys.'],
    [`Which runs on Windows, ${a.name} or ${b.name}?`, [a, b].map((e) => `On Windows, ${esc(e.name)} ${esc(SUPPORT[e.platforms.windows.support].phrase)}.`).join(' ')]
  ];
  const body = `<nav aria-label="${esc(t('Breadcrumb'))}"><ol class="crumbs"><li><a href="${u('/')}">Home</a></li><li><a href="${u('/compare/')}">Compare</a></li><li aria-current="page">${esc(a.name)} vs ${esc(b.name)}</li></ol></nav>
<h1>${esc(a.name)} vs ${esc(b.name)}</h1>
<p class="lede">${esc(a.name)}: ${esc(a.summary)}<br>${esc(b.name)}: ${esc(b.summary)}</p>
<h2>How ${esc(a.name)} and ${esc(b.name)} differ</h2>
${diffs.length ? `<ul class="measure">${diffs.map((d) => `<li>${d}</li>`).join('')}</ul>` : '<p>They support the same protocols and systems.</p>'}
<h2>Side by side</h2>
<div class="table-scroll" tabindex="0"><table class="matrix"><caption class="sr">${th('{a} and {b} side by side', { a: esc(a.name), b: esc(b.name) })}</caption><thead><tr><th scope="col"></th><th scope="col"><a href="${u(a.path)}">${esc(a.name)}</a></th><th scope="col"><a href="${u(b.path)}">${esc(b.name)}</a></th></tr></thead><tbody>
${row('Interface', esc(INTERFACES[a.interface].long), esc(INTERFACES[b.interface].long))}
${row('Language', esc(a.language), esc(b.language))}
${row('License', licenseHtml(a), licenseHtml(b))}
${row('Latest version', a.latest_version ? `<code>${esc(a.latest_version)}</code>` : '-', b.latest_version ? `<code>${esc(b.latest_version)}</code>` : '-')}
${OSES.map((o) => row(o.name, supportCell(a, o.id), supportCell(b, o.id))).join('\n')}
${PROTOCOLS.map(([k, n]) => row(n, protoCell(a, k), protoCell(b, k))).join('\n')}
${FEATURES.map(([k, n]) => row(n, cell(a.features[k]), cell(b.features[k]))).join('\n')}
</tbody></table></div>
<h2>Which to choose</h2>
<div class="grid-2">${[a, b].map((e) => `<div><h3>Choose ${esc(e.name)} for</h3><ul class="pros">${e.pros.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><h3>Watch out for</h3><ul class="cons">${e.cons.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><p><a href="${u(e.path)}">${th('Install {name}', { name: esc(e.name) })}</a></p></div>`).join('')}</div>
${faqBlock(qa)}
<p class="small">See also: <a href="${u(`/alternatives/${a.slug}/`)}">${esc(a.name)} alternatives</a>, <a href="${u(`/alternatives/${b.slug}/`)}">${esc(b.name)} alternatives</a>.</p>`;
  return layout({
    title: fit(60, `${a.name} vs ${b.name}: terminal email clients compared`, `${a.name} vs ${b.name}: email clients compared`, `${a.name} vs ${b.name}`),
    description: compareDescription(a, b, diffs),
    body,
    pathname: c.path,
    jsonld: [{ '@type': 'WebPage', name: `${a.name} vs ${b.name}`, url: abs(c.path), about: [softwareLd(a), softwareLd(b)].map((s) => ({ '@type': 'SoftwareApplication', name: s.name, url: s.url })) }, breadcrumbs([['Home', '/'], ['Compare', '/compare/'], [`${a.name} vs ${b.name}`, c.path]]), faqLd(qa)],
    lastmod: newest([a, b]),
    og: { kind: 'compare', a, b, title: `${a.name} vs ${b.name}`, alt: `${a.name} versus ${b.name}, compared by Terminal Email.` }
  });
}

// Pairs named on the comparison index as examples.
const EXAMPLE_PAIRS = [['mutt', 'neomutt'], ['aerc', 'neomutt'], ['alpine', 'mutt'], ['aerc', 'meli'], ['mu4e', 'notmuch-emacs']];

function compareIndex() {
  const body = `<h1>Compare terminal email clients</h1>
<p class="lede">${comparisons.length} side-by-side comparisons of ${clients.length} terminal email clients: interface, protocols, features and the systems each runs on.</p>
<p class="measure">Each pair is listed once, under the client whose name comes first in the alphabet. Every client page also links to its closest comparisons, and each <a href="${u('/alternatives/')}">alternatives page</a> ranks the other clients by how similar they are. For example: ${joinList(EXAMPLE_PAIRS.map(([x, y]) => comparisonFor(bySlug.get(x), bySlug.get(y))).filter(Boolean).map((c) => `<a href="${u(c.path)}">${esc(c.a.name)} vs ${esc(c.b.name)}</a>`))}.</p>
${[...clients].sort((x, y) => x.slug.localeCompare(y.slug)).map((c) => [c, comparisons.filter((p) => p.a === c)]).filter(([, list]) => list.length).map(([c, list]) => `<h2 id="${esc(c.slug)}">${esc(c.name)}</h2><ul class="link-list">${list.map((p) => `<li><a href="${u(p.path)}">${esc(p.a.name)} vs ${esc(p.b.name)}</a></li>`).join('')}</ul>`).join('\n')}`;
  return layout({ title: 'Compare terminal email clients side by side', description: `${comparisons.length} side-by-side comparisons of terminal email clients, such as Mutt vs NeoMutt and aerc vs NeoMutt: protocols, features and systems.`, body, pathname: '/compare/', jsonld: [breadcrumbs([['Home', '/'], ['Compare', '/compare/']])], lastmod: newest(clients), og: { kind: 'page', title: 'Compare terminal email clients', text: `${comparisons.length} side-by-side comparisons` } });
}

// ---------- alternatives ----------

function why(entry, c) {
  const reasons = [];
  reasons.push(c.interface === entry.interface ? `also ${INTERFACES[c.interface].noun}` : INTERFACES[c.interface].noun);
  const shared = PROTOCOLS.filter(([k]) => entry.protocols[k] === true && c.protocols[k] === true).map(([, n]) => n);
  if (shared.length) reasons.push(`built-in ${joinList(shared)}`);
  const extra = PROTOCOLS.filter(([k]) => c.protocols[k] === true && entry.protocols[k] !== true).map(([, n]) => n);
  if (extra.length && !entry.backend) reasons.push(`adds ${joinList(extra)}`);
  if (c.platforms.windows.support === 'native' && entry.platforms.windows.support !== 'native') reasons.push('runs natively on Windows');
  if (c.features.mouse === true && entry.features.mouse !== true) reasons.push('mouse support');
  if (has(c.features.calendar) && !has(entry.features.calendar)) reasons.push('calendar');
  const s = reasons.join(', ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

function alternativesPage(a) {
  const { entry, list } = a;
  const top = list.slice(0, 10);
  const body = `<nav aria-label="${esc(t('Breadcrumb'))}"><ol class="crumbs"><li><a href="${u('/')}">Home</a></li><li><a href="${u('/alternatives/')}">Alternatives</a></li><li aria-current="page">${esc(entry.name)}</li></ol></nav>
<h1>${esc(entry.name)} alternatives</h1>
<p class="lede">Terminal email clients to use instead of <a href="${u(entry.path)}">${esc(entry.name)}</a>, most similar first: same kind of interface, then shared protocols and systems.</p>
${osKey()}
<div class="table-scroll" tabindex="0"><table class="listing stack"><caption class="sr">${th('{name} alternatives, most similar first', { name: esc(entry.name) })}</caption><thead><tr><th scope="col">${th('Systems')}</th><th scope="col">${th('Client')}</th><th scope="col">${th('Compare')}</th></tr></thead><tbody>
${top.map((c) => `<tr><td class="os-col">${osMatrix(c)}</td><td class="name"><a href="${u(c.path)}">${esc(c.name)}</a>${tags(c)}<span class="sum">${esc(why(entry, c))} ${esc(c.summary)}</span></td><td class="meta"><a href="${u(comparisonFor(entry, c).path)}">vs ${esc(entry.name)}</a></td></tr>`).join('\n')}
</tbody></table></div>
${list.length > top.length ? `<p class="small">Also: ${linkNames(list.slice(top.length))}.</p>` : ''}`;
  return layout({
    title: fit(60, `${entry.name} alternatives: ${top.length} terminal email clients`, `${entry.name} alternatives: ${top.length} terminal clients`, `${entry.name} alternatives`),
    description: fit(155, `Alternatives to ${entry.name}: ${names(top.slice(0, 5)).join(', ')} and more terminal email clients, with why each one is similar and a side-by-side comparison.`, `Alternatives to ${entry.name}: ${names(top.slice(0, 5)).join(', ')} and more terminal email clients, with why each one is similar.`, `Alternatives to ${entry.name}: ${names(top.slice(0, 3)).join(', ')} and more terminal email clients, with why each one is similar.`),
    body,
    pathname: a.path,
    jsonld: [{ '@type': 'CollectionPage', name: `${entry.name} alternatives`, url: abs(a.path), mainEntity: itemList(`${entry.name} alternatives`, top) }, breadcrumbs([['Home', '/'], ['Alternatives', '/alternatives/'], [entry.name, a.path]])],
    lastmod: newest([entry, ...top]),
    og: { kind: 'list', title: `${entry.name} alternatives`, list: top }
  });
}

function alternativesIndex() {
  const body = `<h1>Alternatives to terminal email clients</h1>
<p class="lede">For each client, the others ranked by how similar they are.</p>
<ul class="link-list">${alternatives.map((a) => `<li><a href="${u(a.path)}">${esc(a.entry.name)} alternatives</a></li>`).join('')}</ul>`;
  return layout({ title: 'Terminal email client alternatives', description: `Alternatives to Mutt, NeoMutt, Alpine, aerc and ${clients.length - 4} other terminal email clients, ranked by interface, shared protocols and systems.`, body, pathname: '/alternatives/', jsonld: [breadcrumbs([['Home', '/'], ['Alternatives', '/alternatives/']])], lastmod: newest(clients), og: { kind: 'page', title: 'Terminal email client alternatives', text: 'Ranked by how similar they are' } });
}

// ---------- feature lists ----------

function featurePage(f) {
  const body = `<nav aria-label="${esc(t('Breadcrumb'))}"><ol class="crumbs"><li><a href="${u('/')}">Home</a></li><li><a href="${u('/features/')}">Features</a></li><li aria-current="page">${esc(f.h1)}</li></ol></nav>
<h1>${esc(f.h1)}</h1>
<p class="lede">${esc(f.intro)} ${plural(f.list.length, 'client', 'clients')} on this site qualify.</p>
${f.about ? `<p class="measure">${esc(f.about)} ${interfaceCounts(f.list).replace(/^Of the (\d+) clients? on this site,/, 'Of these $1,')} Terms are explained in <a href="${u('/glossary/')}">the glossary</a>.</p>` : ''}
${osKey()}
${listing(f.list, { caption: `${f.list.length} clients` })}
<p class="small">Other lists: ${joinList(features.filter((x) => x !== f).map((x) => `<a href="${u(x.path)}">${esc(x.title.replace(/^Terminal email clients with /, '').replace(/ email clients$/, ''))}</a>`))}.</p>`;
  const some = f.list.length > 6 ? `${names(f.list.slice(0, 6)).join(', ')} and more` : joinList(names(f.list));
  return layout({ title: f.title, description: fit(155, `${f.intro} ${some}, with install commands.`, `${f.intro} ${some}.`, `${f.intro} ${names(f.list.slice(0, 4)).join(', ')} and more.`), body, pathname: f.path, jsonld: [{ '@type': 'CollectionPage', name: f.h1, url: abs(f.path), mainEntity: itemList(f.h1, f.list) }, breadcrumbs([['Home', '/'], ['Features', '/features/'], [f.h1, f.path]])], lastmod: newest(f.list), og: { kind: 'list', title: f.h1, list: f.list } });
}

function featuresIndex() {
  const body = `<h1>Terminal email clients by feature</h1>
<ul class="link-list">${features.map((f) => `<li><a href="${u(f.path)}">${esc(f.h1)}</a> <span class="muted">(${f.list.length})</span></li>`).join('')}</ul>`;
  return layout({ title: 'Terminal email clients by feature', description: `${features.length} lists of terminal email clients by feature: OpenPGP, IMAP, JMAP, Maildir, notmuch, OAuth2, mouse support, Vim keys and more.`, body, pathname: '/features/', jsonld: [breadcrumbs([['Home', '/'], ['Features', '/features/']])], lastmod: newest(clients), og: { kind: 'page', title: 'Terminal email clients by feature', text: 'PGP, JMAP, Maildir, notmuch, OAuth2 and more' } });
}

// ---------- setup ----------

function setupPage() {
  const list = entries.filter((e) => !e.featured);
  const body = `<h1>Forward Email settings for terminal email clients</h1>
<p class="lede">Server names, ports and a working config for each client and tool on this site.</p>
${settingsTable()}
<p class="note">Forward Email's own terminal app needs none of this: install it with <code>npm install -g forwardemail</code> or the <a href="${u(featured.path)}">standalone build</a>, run <code>forwardemail</code> and sign in.</p>
<h2>Configs</h2>
<ul class="link-list">${list.map((e) => `<li><a href="#${esc(e.slug)}">${esc(e.name)}</a></li>`).join('')}</ul>
${list.map((e) => `<section aria-labelledby="${esc(e.slug)}"><h3 id="${esc(e.slug)}"><a href="${u(e.path)}">${esc(e.name)}</a></h3>${codeBlock(e.forward_email, { title: e.forward_email_file || 'Configuration' })}</section>`).join('\n')}`;
  return layout({ title: 'Forward Email IMAP and SMTP settings for terminal clients', description: 'Forward Email IMAP, POP3 and SMTP settings, with configs for NeoMutt, Mutt, aerc, meli, Alpine, Himalaya, isync, msmtp and more.', body, pathname: '/setup/', type: 'article', jsonld: [{ '@type': 'HowTo', name: 'Set up a terminal email client with Forward Email', step: [{ '@type': 'HowToStep', text: 'Generate a password for your alias in your Forward Email account.' }, { '@type': 'HowToStep', text: 'Set the IMAP server to imap.forwardemail.net, port 993, SSL/TLS.' }, { '@type': 'HowToStep', text: 'Set the SMTP server to smtp.forwardemail.net, port 465, SSL/TLS.' }, { '@type': 'HowToStep', text: 'Use your full alias address as the username.' }] }, breadcrumbs([['Home', '/'], ['Setup', '/setup/']])], lastmod: newest(entries), og: { kind: 'page', title: 'Forward Email settings for terminal clients', text: 'imap.forwardemail.net:993 and smtp.forwardemail.net:465' } });
}

// ---------- documents, search, errors ----------

function docPage(d) {
  const body = `<article class="prose"><h1>${esc(d.title)}</h1>${md(d.body.replace(/^# .*\n+/, ''))}</article>`;
  return layout({ title: d.title, description: d.description, body, pathname: d.path, type: 'article', jsonld: [{ '@type': d.slug === 'about' ? 'AboutPage' : 'WebPage', name: d.title, url: abs(d.path), description: d.description, isPartOf: { '@id': `${abs('/')}#website` }, publisher: { '@id': `${abs('/')}#organization` } }, breadcrumbs([['Home', '/'], [d.title, d.path]])], lastmod: lastmod(d.file), og: { kind: 'page', title: d.title, text: d.description } });
}

function searchPage() {
  const body = `<h1>Search</h1>
<form role="search" action="${u('/search/')}" method="get" class="filter-row"><div class="filter-field"><label class="sr" for="q">${th('Search clients and tools')}</label><input id="q" name="q" type="search" placeholder="${esc(t('search: neomutt, windows, jmap…'))}" autocomplete="off" spellcheck="false" data-search data-autofill></div><button class="btn" type="submit">${th('Search')}</button></form>
<ul class="results" data-results hidden aria-live="polite"></ul>
<noscript><p>Search needs JavaScript. Browse <a href="${u('/clients/')}">all clients</a> or <a href="${u('/systems/')}">clients by system</a> instead.</p></noscript>`;
  return layout({ title: 'Search clients and tools', description: 'Search terminal email clients, mail tools, systems and comparisons.', body, pathname: '/search/', noindex: true, markdown: false });
}

function offlinePage() {
  const body = `<p class="err-code" aria-hidden="true">offline</p><h1>No connection</h1><p>This page is not saved for offline use. Pages you opened before still work.</p><p><button class="btn" type="button" data-reload>${th('Try again')}</button></p>`;
  return layout({ title: 'Offline', description: 'No connection.', body, pathname: '/offline/', noindex: true, markdown: false, shareable: false });
}

function notFound() {
  const body = `<p class="err-code" aria-hidden="true">404</p><h1>Page not found</h1><p class="prompt"><b>$</b> cd ${esc('/the/page/you/wanted')}: no such file or directory</p><p>Try <a href="${u('/clients/')}">all clients</a>, <a href="${u('/systems/')}">clients by system</a> or <a href="${u('/search/')}">search</a>.</p>`;
  return layout({ title: 'Page not found', description: 'This page does not exist.', body, pathname: '/404.html', noindex: true, markdown: false, shareable: false });
}

module.exports = { faqBlock, interfaceCounts, maildirOnly, linkNames, nativeOn, winRest, settingsTable, homePage, entryPage, clientsIndex, toolsIndex, systemsIndex, systemPage, comparePage, compareIndex, alternativesPage, alternativesIndex, featurePage, featuresIndex, setupPage, docPage, searchPage, offlinePage, notFound, differences, why, homeFaq, entryFaq, systemFaq, OS_TEXT };
