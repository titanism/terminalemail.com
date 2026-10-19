'use strict';

// Guide pages: the best client for each need, questions and answers, and a glossary. Like every
// other page, the facts in them come from the data files, so counts and lists never go stale.
// A pick states why it was chosen; each pick has a check, and the build fails if the data no
// longer supports the reason given.

const ctx = require('./context');
const lib = require('./lib');
const T = require('./templates');
const P = require('./pages');
const { t, th } = require('./i18n');

const { clients, tools, featured, systems, features, comparisonFor, bySlug, entries, newest } = ctx;
const { SUPPORT, INTERFACES, PROTOCOLS } = lib;
const { esc, u, abs, layout, breadcrumbs, itemList, faqLd, cell, joinList, plural, headingSlug } = T;
const { interfaceCounts, maildirOnly, linkNames, nativeOn, winRest } = P;

const strip = (html) => String(html).replace(/<\/?code>/g, '`').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const link = (e) => `<a href="${u(e.path)}">${esc(e.name)}</a>`;
const entry = (slug) => {
  const e = bySlug.get(slug);
  if (!e) throw new Error(`scripts/guides.js: no client with slug ${slug}`);
  return e;
};
const protoNames = (e) => PROTOCOLS.filter(([k]) => e.protocols[k] === true).map(([, n]) => n);
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
// The first item matching a pattern, for answers quoted from the data. Fails the build if none does.
const must = (list, re) => {
  const hit = list.find((x) => re.test(x));
  if (!hit) throw new Error(`scripts/guides.js: nothing in the data matches ${re}`);
  return hit.replace(/\.$/, '');
};

// ---------- best clients by need ----------

// Each pick: the need, the client (or none, for a list), a check that the data still supports
// the answer, the answer, and other clients worth a look.
const PICKS = [
  {
    id: 'all-round',
    heading: 'Best all-round terminal email client',
    short: 'all-round',
    slug: 'neomutt',
    check: (e) => e.interface === 'tui' && ['imap', 'pop3', 'smtp', 'maildir', 'mbox', 'notmuch'].every((k) => e.protocols[k] === true) && e.pros.some((p) => /muttrc/.test(p)),
    answer: (e) => `${link(e)} suits most people who want a keyboard-driven, full-screen client. It has ${joinList(protoNames(e))} built in, so it works with a mail server directly or with local folders, and it reads most existing muttrc files.`,
    also: (e) => [entry('mutt'), entry('meli')].filter((x) => x !== e)
  },
  {
    id: 'modern',
    heading: 'Best for OAuth2, JMAP and mouse support',
    short: 'for OAuth2 and JMAP',
    slug: 'aerc',
    check: (e) => e.features.oauth2 === true && ['imap', 'jmap', 'maildir', 'notmuch'].every((k) => e.protocols[k] === true) && e.features.mouse === true && /Embedded terminal/.test(e.pros[0]),
    answer: (e) => `${link(e)} signs in with OAuth2 by itself, speaks JMAP as well as IMAP, reads notmuch and Maildir, and responds to the mouse. Its embedded terminal runs your editor inside the client.`,
    also: () => clients.filter((c) => c.features.oauth2 === true && c.slug !== 'aerc' && !c.backend)
  },
  {
    id: 'beginners',
    heading: 'Best for beginners',
    short: 'for beginners',
    slug: 'alpine',
    check: (e) => /setup screens/.test(String(e.features.config)) && /Command list/.test(e.pros[0]) && e.platforms.windows.support === 'native',
    answer: (e) => `${link(e)} is configured through setup screens instead of a hand-written file, and it shows the available commands at the bottom of every screen. It also runs natively on Windows.`,
    also: () => clients.filter((c) => c.interface === 'tui' && c.features.mouse === true && c.platforms.windows.support === 'native' && c.slug !== 'alpine' && !c.backend)
  },
  {
    id: 'windows',
    heading: 'Best terminal email clients for Windows',
    slug: null,
    check: () => nativeOn('windows').length > 0,
    answer: () => `${linkNames(nativeOn('windows'))} run natively on Windows. ${winRest()} See <a href="${u('/windows/')}">terminal email on Windows</a> for install commands.`
  },
  {
    id: 'scripting',
    heading: 'Best for scripts and the shell',
    short: 'for scripts',
    slug: 'himalaya',
    check: (e) => e.interface === 'cli' && /JSON/.test(e.pros[0]),
    answer: (e) => `${link(e)} turns each action, such as listing, reading or sending a message, into a shell command with optional JSON output, so it fits scripts and editor plugins.`,
    also: (e) => clients.filter((c) => c.interface === 'cli' && c !== e)
  },
  {
    id: 'emacs',
    heading: 'Best for Emacs users',
    short: 'for Emacs',
    slug: 'mu4e',
    check: (e) => e.interface === 'emacs' && e.protocols.maildir === true && e.pros.some((p) => /search/i.test(p)),
    answer: (e) => `${link(e)} gives fast full-text search over a local Maildir, kept in sync by a tool such as <a href="${u('/tools/isync/')}">isync</a>. To read IMAP inside Emacs without a sync tool, ${linkNames(clients.filter((c) => c.interface === 'emacs' && c.protocols.imap === true))} connect directly.`,
    also: (e) => clients.filter((c) => c.interface === 'emacs' && c !== e)
  },
  {
    id: 'search',
    heading: 'Best for tags and full-text search',
    slug: null,
    check: () => clients.filter((c) => c.protocols.notmuch === true).length >= 2,
    answer: () => `${linkNames(clients.filter((c) => c.protocols.notmuch === true))} work on a <a href="${u('/tools/notmuch/')}">notmuch</a> database, which adds tags, threads and fast full-text search to a local Maildir. Folders become saved searches.`
  },
  {
    id: 'android',
    heading: 'Best for Android',
    slug: null,
    check: () => clients.some((c) => c.platforms.android.support === 'termux'),
    answer: () => `${plural(clients.filter((c) => c.platforms.android.support === 'termux').length, 'client runs', 'clients run')} on Android through <a href="https://termux.dev/" rel="noopener">Termux</a>: ${linkNames(clients.filter((c) => c.platforms.android.support === 'termux'))}. See <a href="${u('/android/')}">terminal email on Android</a>.`
  },
  {
    id: 'all-in-one',
    heading: 'Best for mail, calendar and contacts in one app',
    slug: featured ? featured.slug : null,
    check: (e) => e.featured && clients.filter((c) => c.features.calendar === true && c.features.contacts === true).length === 1 && e.cons.some((c) => /Only works with Forward Email/.test(c)),
    answer: (e) => `${link(e)}, made by the team behind this site, is the only client here with its own calendar and contact list alongside mail. It works only with Forward Email accounts; every other pick on this page works with any provider.`
  }
];

const picks = PICKS.map((p) => {
  const e = p.slug ? entry(p.slug) : null;
  if (!p.check(e)) throw new Error(`scripts/guides.js: the data no longer supports the "${p.id}" pick. Update the pick or its reason.`);
  return { ...p, e, also: p.also ? p.also(e).filter((x) => !x.featured) : [] };
});
const pickEntries = picks.filter((p) => p.e).map((p) => p.e);

function bestTable() {
  const head = ['Client', 'Interface', 'IMAP', 'JMAP', 'notmuch', 'OAuth2', 'Windows'];
  const rows = clients.map((c) => {
    const win = c.platforms.windows.support;
    const proto = (k) => (c.backend ? '<span class="muted">API</span>' : cell(c.protocols[k]));
    return `<tr><th scope="row">${link(c)}</th><td>${esc(INTERFACES[c.interface].label)}</td><td>${proto('imap')}</td><td>${proto('jmap')}</td><td>${proto('notmuch')}</td><td>${cell(c.features.oauth2)}</td><td>${win === 'native' ? '<span class="yes">Native</span>' : win === 'none' ? '<span class="no">No</span>' : `<span class="part">${esc(SUPPORT[win].label)}</span>`}</td></tr>`;
  });
  return `<div class="table-scroll" tabindex="0"><table class="matrix"><caption class="sr">${th('{n} clients by interface, protocols, OAuth2 and Windows support', { n: clients.length })}</caption><thead><tr>${head.map((h) => `<th scope="col">${th(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function chooseSteps() {
  const oauth = features.find((f) => f.slug === 'oauth2');
  return [
    ['Which system do you use?', `All ${clients.length} clients run on Linux. On other systems the list is shorter: ${joinList(systems.filter((s) => s.id !== 'linux').map((s) => `<a href="${u(s.path)}">${esc(s.name)}</a> has ${s.clients.length}`))}.`],
    ['Full-screen, commands or Emacs?', `${interfaceCounts()} Full-screen clients work like an app; command-line clients fit scripts; Emacs clients use Emacs buffers and keys.`],
    ['Does your provider need OAuth2?', `Gmail and Microsoft 365 accounts often sign in with OAuth2. ${oauth ? `<a href="${u(oauth.path)}">${plural(oauth.list.length, 'client supports', 'clients support')} it</a>,` : 'Some clients support it,'} built in or through a helper script.`],
    ['Do you want mail offline?', `Clients that read Maildir keep a full copy on disk. ${plural(maildirOnly().length, 'client reads', 'clients read')} only local folders and ${maildirOnly().length === 1 ? 'needs' : 'need'} a sync tool such as <a href="${u('/tools/isync/')}">isync</a>.`]
  ];
}

function bestPage() {
  const crumbs = [['Home', '/'], ['Best clients', '/best/']];
  const steps = chooseSteps();
  const body = `<nav aria-label="${esc(t('Breadcrumb'))}"><ol class="crumbs"><li><a href="${u('/')}">${th('Home')}</a></li><li aria-current="page">${th('Best clients')}</li></ol></nav>
<h1>Best terminal email clients</h1>
<p class="lede">${link(picks[0].e)} is the best all-round terminal email client for most people. The right choice depends on your system, your provider and how you like to work, so this page picks one client for each common need, with the facts behind each pick.</p>
<p class="measure">The picks come from the data on each client's page, which links to the sources it was checked against. ${interfaceCounts()}</p>
<nav aria-label="${esc(t('Picks on this page'))}"><ul class="link-list">${picks.map((p) => `<li><a href="#${p.id}">${esc(p.heading)}</a></li>`).join('')}</ul></nav>
${picks
  .map(
    (p) => `<section class="pick" aria-labelledby="${p.id}"><h2 id="${p.id}">${esc(p.heading)}${p.e ? `: ${esc(p.e.name)}` : ''}</h2>
<p class="measure">${p.answer(p.e)}</p>
${p.e ? `<div class="grid-2"><div><h3>${th('Why')}</h3><ul class="pros">${p.e.pros.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h3>${th('Watch out for')}</h3><ul class="cons">${p.e.cons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
<p class="links-row"><a class="btn" href="${u(p.e.path)}">${th('Install {name}', { name: esc(p.e.name) })}</a>${p.e.type === 'client' ? `<a class="btn btn-quiet" href="${u(`/alternatives/${p.e.slug}/`)}">${th('{name} alternatives', { name: esc(p.e.name) })}</a>` : ''}</p>` : ''}
${p.also.length ? `<p class="small">${th('Also consider:')} ${p.also.map((x) => (p.e && comparisonFor(p.e, x) ? `${link(x)} (<a href="${u(comparisonFor(p.e, x).path)}">${esc(p.e.name)} vs ${esc(x.name)}</a>)` : link(x))).join(', ')}.</p>` : ''}
</section>`
  )
  .join('\n')}
<section aria-labelledby="glance-h"><h2 id="glance-h">All ${clients.length} clients at a glance</h2>
<p class="measure">${th('Built-in support for the protocols and sign-in methods that decide most choices. Each client page has the full list.')}</p>
${bestTable()}
</section>
<section aria-labelledby="choose-h"><h2 id="choose-h">How do I choose a terminal email client?</h2>
<p class="measure">Answer four questions, then compare the two or three clients that are left on the <a href="${u('/compare/')}">comparison pages</a>.</p>
<ol class="measure">${steps.map(([q, a]) => `<li><strong>${esc(q)}</strong> ${a}</li>`).join('')}</ol>
</section>
<section aria-labelledby="how-h"><h2 id="how-h">How the picks are made</h2>
<p class="measure">Each pick is the client whose listed facts match the need most closely, and the reason given is a fact from its page. When the data changes so that a reason no longer holds, the site does not build until the pick is updated. Forward Email makes this site. Its app is picked only for mail, calendar and contacts in one program, because no other client here has all three, and it is marked as featured wherever it appears. <a href="${u('/about/')}">How the list is made</a>.</p>
</section>`;
  return layout({
    title: 'Best terminal email clients by need',
    description: `The best terminal email client for each need: ${joinList(picks.filter((p) => p.e && p.short).map((p) => `${p.e.name} ${p.short}`))}.`,
    body,
    pathname: '/best/',
    type: 'article',
    jsonld: [{ '@type': 'WebPage', '@id': `${abs('/best/')}#page`, name: 'Best terminal email clients', url: abs('/best/'), isPartOf: { '@id': `${abs('/')}#website` }, publisher: { '@id': `${abs('/')}#organization` }, about: { '@type': 'Thing', name: 'Terminal email clients' }, mainEntity: itemList('Best terminal email clients by need', pickEntries) }, breadcrumbs(crumbs)],
    lastmod: newest(clients),
    og: { kind: 'list', title: 'Best terminal email clients', list: pickEntries, alt: `Best terminal email clients by need: ${pickEntries.map((e) => e.name).join(', ')}.` }
  });
}

function bestMd() {
  return `# Best terminal email clients

${picks[0].e.name} is the best all-round terminal email client for most people. The right choice depends on your system, your provider and how you like to work, so this page picks one client for each common need.

${picks
  .map(
    (p) => `## ${p.heading}${p.e ? `: ${p.e.name}` : ''}

${strip(p.answer(p.e))}
${p.e ? `\nWhy:\n\n${p.e.pros.map((x) => `- ${x}`).join('\n')}\n\nWatch out for:\n\n${p.e.cons.map((x) => `- ${x}`).join('\n')}\n\nPage: ${abs(p.e.path)}\n` : ''}${p.also.length ? `\nAlso consider: ${p.also.map((x) => `[${x.name}](${abs(x.path)})`).join(', ')}.\n` : ''}`
  )
  .join('\n')}
## How do I choose a terminal email client?

${chooseSteps()
  .map(([q, a], i) => `${i + 1}. **${q}** ${strip(a)}`)
  .join('\n')}

## How the picks are made

Each pick is the client whose listed facts match the need most closely, and the reason given is a fact from its page. Forward Email makes this site; its app is picked only for mail, calendar and contacts in one program, because no other client here has all three.
`;
}

// ---------- questions and answers ----------

function faqList() {
  const mutt = entry('mutt');
  const neomutt = entry('neomutt');
  if (!/Fork of Mutt/.test(neomutt.lineage || '')) throw new Error('scripts/guides.js: NeoMutt is no longer listed as a fork of Mutt');
  const muttVs = comparisonFor(mutt, neomutt);
  const pgp = features.find((f) => f.slug === 'pgp');
  const android = clients.filter((c) => c.platforms.android.support === 'termux');
  const noSmtp = clients.filter((c) => c.protocols.smtp !== true && !c.backend);
  const others = entries.filter((e) => !e.featured);
  const passCmd = others.filter((e) => /pass(\s+show|", "show)|get_pass|passwordeval|PassCmd/.test(e.forward_email));
  const home = Object.fromEntries(P.homeFaq());
  return [
    ['What is a terminal email client?', home['What is a terminal email client?']],
    ['What is the best terminal email client?', `For most people, ${link(entry('neomutt'))}: a full-screen client with IMAP, POP3, SMTP, Maildir and notmuch built in. ${link(entry('aerc'))} suits people who want OAuth2, JMAP and mouse support, and ${link(entry('alpine'))} suits beginners. See <a href="${u('/best/')}">the best client for each need</a>.`],
    ['What is the difference between a TUI and a CLI email client?', `A TUI (text user interface) client fills the terminal with lists and menus and works like an app. A CLI (command-line interface) client is a set of commands you run and script. ${interfaceCounts()}`],
    ['What is the difference between Mutt and NeoMutt?', `${link(neomutt)} is a fork of ${link(mutt)}. ${esc(mutt.name)} has ${esc(lower(must(mutt.cons, /NeoMutt has/)))}. ${esc(neomutt.name)} ${esc(lower(must(neomutt.pros, /muttrc/)))}, and ${esc(mutt.name)} has ${esc(lower(must(mutt.pros, /Conservative/)))}.${muttVs ? ` See <a href="${u(muttVs.path)}">Mutt vs NeoMutt</a>.` : ''}`],
    ['Which terminal email clients run natively on Windows?', home['Which terminal email clients run natively on Windows?']],
    ['Can I read email in a terminal on Android?', `Yes, through <a href="https://termux.dev/" rel="noopener">Termux</a>, which runs a Linux-style terminal on Android without root. ${plural(android.length, 'client runs', 'clients run')} there: ${linkNames(android)}. A hardware keyboard helps with the full-screen ones.`],
    ['Can I use Gmail or Outlook?', home['Can I use Gmail or Outlook?']],
    ['Do I need a sync tool such as isync?', `Only for clients without built-in IMAP. ${linkNames(maildirOnly())} read local folders, so a sync tool such as <a href="${u('/tools/isync/')}">isync</a> or <a href="${u('/tools/offlineimap/')}">OfflineIMAP</a> copies mail from the server into a Maildir and back. Clients with built-in IMAP can still use one to keep a full offline copy.`],
    ['How do I send mail from a client that has no SMTP support?', `Use a sendmail-compatible program such as <a href="${u('/tools/msmtp/')}">msmtp</a>: the client hands it each message, and msmtp sends it to your provider's SMTP server. ${linkNames(noSmtp)} ${noSmtp.length === 1 ? 'sends' : 'send'} this way.`],
    ['Where do I keep my email password?', `In a password manager, not in the config file. ${passCmd.length} of the ${others.length} configs on this site read the password from a command, such as <code>pass show email/forwardemail</code>, each time the program connects.`],
    ['Can terminal clients show HTML email?', home['Can terminal clients show HTML email?']],
    ['Can I encrypt email with OpenPGP in a terminal?', `Yes. ${pgp ? `<a href="${u(pgp.path)}">${plural(pgp.list.length, 'client signs', 'clients sign')} and ${pgp.list.length === 1 ? 'encrypts' : 'encrypt'} mail with OpenPGP</a>` : 'Several clients sign and encrypt mail with OpenPGP'}, built in or through a plugin.`],
    ['Which clients support JMAP?', home['Which clients support JMAP?']],
    ['Which clients work with a mouse?', home['Which clients work with a mouse?']],
    ['Are they open source?', home['Are they open source?']],
    ['How do I use a terminal client with Forward Email?', home['How do I use a terminal client with Forward Email?']],
    ['Who makes Terminal Email?', `<a href="https://forwardemail.net" rel="noopener">Forward Email</a>, whose terminal app is featured and marked as such. Every other client is listed with the same facts and works with any provider. See <a href="${u('/about/')}">how the list is made</a>.`]
  ];
}

function faqPage() {
  const qa = faqList();
  const body = `<nav aria-label="${esc(t('Breadcrumb'))}"><ol class="crumbs"><li><a href="${u('/')}">${th('Home')}</a></li><li aria-current="page">${th('Questions')}</li></ol></nav>
<h1>Terminal email questions and answers</h1>
<p class="lede">Short answers about reading and sending email in a terminal: which client to pick, how syncing and sending work, and how to use Gmail, Outlook or Forward Email. Every count on this page comes from the ${entries.length} clients and tools on this site.</p>
<nav aria-label="${esc(t('Questions on this page'))}"><ul class="link-list">${qa.map(([q]) => `<li><a href="#${headingSlug(q)}">${esc(q)}</a></li>`).join('')}</ul></nav>
<div class="qa">${qa.map(([q, a]) => `<section aria-labelledby="${headingSlug(q)}"><h2 id="${headingSlug(q)}">${esc(q)}</h2><p>${a}</p></section>`).join('\n')}</div>
<p>Terms such as Maildir and STARTTLS are explained in <a href="${u('/glossary/')}">the glossary</a>.</p>`;
  return layout({
    title: 'Terminal email questions and answers',
    description: `Answers about terminal email: the best client, Mutt vs NeoMutt, Gmail and Outlook with OAuth2, syncing with isync, sending with msmtp, Windows and Android.`,
    body,
    pathname: '/faq/',
    type: 'article',
    jsonld: [{ '@type': 'WebPage', '@id': `${abs('/faq/')}#page`, name: 'Terminal email questions and answers', url: abs('/faq/'), isPartOf: { '@id': `${abs('/')}#website` } }, faqLd(qa), breadcrumbs([['Home', '/'], ['Questions', '/faq/']])],
    lastmod: newest(entries),
    og: { kind: 'page', title: 'Terminal email questions and answers', text: `${qa.length} questions, answered from the data` }
  });
}

const faqMd = () => `# Terminal email questions and answers

${faqList()
  .map(([q, a]) => `## ${q}\n\n${strip(a)}`)
  .join('\n\n')}
`;

// ---------- glossary ----------

const rfc = (n) => `<a href="https://www.rfc-editor.org/rfc/rfc${n}.html" rel="noopener">RFC ${n}</a>`;
function terms() {
  const others = entries.filter((e) => !e.featured);
  const feature = (slug, text) => {
    const f = features.find((x) => x.slug === slug);
    return f ? ` See <a href="${u(f.path)}">${esc(text)}</a> (${f.list.length}).` : '';
  };
  const nntp = ['neomutt', 'alpine', 'cone', 'meli', 'gnus', 'wanderlust'].map(entry);
  return [
    ['Terminal email client', `A program that reads and sends email inside a terminal window, using text instead of graphics. This site lists ${plural(clients.length, 'client', 'clients')} and ${plural(tools.length, 'mail tool', 'mail tools')}.`],
    ['TUI', `Text user interface: a full-screen program in a terminal, with lists, menus and keyboard shortcuts. ${link(entry('neomutt'))}, ${link(entry('aerc'))} and ${link(entry('alpine'))} are TUI clients.`],
    ['CLI', `Command-line interface: each action is a separate command you type or put in a script. ${linkNames(clients.filter((c) => c.interface === 'cli'))} are CLI clients.`],
    ['MUA', 'Mail user agent: the program you read and write mail with. Every client on this site is an MUA.'],
    ['MTA', 'Mail transfer agent: server software that receives mail and relays it to other servers over SMTP.'],
    ['IMAP', `Internet Message Access Protocol: reads mail that stays on the server, so folders and read status match on every device. The current version is IMAP4rev2, ${rfc(9051)}. Clients connect on port 993 with TLS.${feature('imap', 'clients with built-in IMAP')}`],
    ['POP3', `Post Office Protocol version 3: downloads mail from the server to one device, ${rfc(1939)}. Clients connect on port 995 with TLS.${feature('pop3', 'clients with POP3')}`],
    ['SMTP', `Simple Mail Transfer Protocol: sends mail, ${rfc(5321)}. A client submits mail on port 465 with TLS or on port 587 with STARTTLS.`],
    ['JMAP', `JSON Meta Application Protocol: a newer way to read and send mail over HTTPS with JSON, defined in ${rfc(8620)} and ${rfc(8621)}. Only some providers offer it.${feature('jmap', 'clients with JMAP')}`],
    ['Maildir', `A mail folder format that stores each message in its own file, in <code>tmp</code>, <code>new</code> and <code>cur</code> subfolders, so programs can add and read mail at the same time without locking (<a href="https://cr.yp.to/proto/maildir.html" rel="noopener">the Maildir specification</a>).${feature('maildir', 'clients that read Maildir')}`],
    ['mbox', `A mail folder format that stores every message in one file, each starting with a line that begins with the word From and a space, described in ${rfc(4155)}.`],
    ['MH', `A mail folder format and set of commands from the MH message handling system: one numbered file per message. ${link(entry('nmh'))} is the maintained version.`],
    ['notmuch', `A mail indexer that adds tags, threads and fast full-text search to a local Maildir. Folders become saved searches. See ${link(entry('notmuch'))}.${feature('notmuch', 'clients for notmuch')}`],
    ['Sync tool', `A program that copies mail between an IMAP server and local Maildir folders in both directions, such as ${link(entry('isync'))} (the <code>mbsync</code> command) and ${link(entry('offlineimap'))}. Clients without built-in IMAP need one.`],
    ['sendmail interface', `A convention for sending mail: a program runs a <code>sendmail</code> command and passes the message on standard input. ${link(entry('msmtp'))} provides this interface and sends the message over SMTP.`],
    ['Password command', `A config setting that runs a program to get the password, such as <code>pass show email/forwardemail</code>, so the password is not stored in the config file. ${passCount(others)} of the ${others.length} configs on this site use one.`],
    ['pass', 'The standard Unix password manager: it keeps each password in a file encrypted with GnuPG (<a href="https://www.passwordstore.org/" rel="noopener">passwordstore.org</a>).'],
    ['OAuth2', `A sign-in method where the provider gives the client a token instead of the client storing your password, ${rfc(6749)}. Mail clients pass the token with the SASL mechanism OAUTHBEARER (${rfc(7628)}) or the older XOAUTH2. Gmail and Microsoft 365 support it.${feature('oauth2', 'clients with OAuth2')}`],
    ['OpenPGP', `A standard for signing and encrypting mail with public keys, ${rfc(9580)}. GnuPG is a free implementation of it.${feature('pgp', 'clients with OpenPGP')}`],
    ['S/MIME', `A standard for signing and encrypting mail with X.509 certificates, ${rfc(8551)}.`],
    ['TLS', `Transport Layer Security: encrypts the connection between a client and a mail server. With implicit TLS the connection is encrypted from the start (ports 993, 995 and 465), which ${rfc(8314)} recommends.`],
    ['STARTTLS', `A command that upgrades a plain connection to TLS on the same port. Mail clients use it on port 587 to send mail (${rfc(3207)}).`],
    ['mailcap', `A file that maps types of content, such as HTML, to programs that can show them, ${rfc(1524)}. Mutt and NeoMutt use it to pass HTML mail to a text browser such as w3m or lynx.`],
    ['Threading', `Grouping messages into conversations using the Message-ID, In-Reply-To and References headers of each message (${rfc(5322)}).`],
    ['NNTP', `Network News Transfer Protocol, used to read Usenet newsgroups, ${rfc(3977)}. ${linkNames(nntp)} read newsgroups as well as mail.`],
    ['WSL', `Windows Subsystem for Linux: runs a Linux system next to Windows, so Linux clients run on Windows (<a href="https://learn.microsoft.com/en-us/windows/wsl/" rel="noopener">Microsoft's WSL documentation</a>). See <a href="${u('/windows/')}">terminal email on Windows</a>.`],
    ['Termux', `A terminal and Linux-style package system for Android that works without root (<a href="https://termux.dev/" rel="noopener">termux.dev</a>). See <a href="${u('/android/')}">terminal email on Android</a>.`],
    ['Generated password', `A password a provider creates for one mail program, separate from the password you sign in with. In Forward Email it is the Generate Password option next to each alias. See <a href="${u('/setup/')}">Forward Email settings</a>.`]
  ].map(([term, html]) => ({ term, id: headingSlug(term), html }));
}
const passCount = (list) => list.filter((e) => /pass(\s+show|", "show)|get_pass|passwordeval|PassCmd/.test(e.forward_email)).length;

function glossaryPage() {
  const list = terms();
  const body = `<nav aria-label="${esc(t('Breadcrumb'))}"><ol class="crumbs"><li><a href="${u('/')}">${th('Home')}</a></li><li aria-current="page">${th('Glossary')}</li></ol></nav>
<h1>Terminal email glossary</h1>
<p class="lede">${list.length} terms you meet when you set up email in a terminal, from IMAP and Maildir to OAuth2 and STARTTLS. Protocol terms link to the standard that defines them.</p>
<nav aria-label="${esc(t('Terms on this page'))}"><p class="small">${list.map((x) => `<a href="#${x.id}">${esc(x.term)}</a>`).join(' · ')}</p></nav>
<dl class="glossary">${list.map((x) => `<dt id="${x.id}">${esc(x.term)}</dt><dd>${x.html}</dd>`).join('\n')}</dl>
<p>For which client to use, see <a href="${u('/best/')}">the best clients by need</a> and <a href="${u('/faq/')}">questions and answers</a>.</p>`;
  return layout({
    title: 'Terminal email glossary: IMAP, Maildir, JMAP and more',
    description: `${list.length} terms for email in a terminal explained: IMAP, POP3, SMTP, JMAP, Maildir, mbox, notmuch, OAuth2, OpenPGP, STARTTLS, WSL and more.`,
    body,
    pathname: '/glossary/',
    type: 'article',
    jsonld: [{ '@type': 'DefinedTermSet', '@id': `${abs('/glossary/')}#terms`, name: 'Terminal email glossary', url: abs('/glossary/'), hasDefinedTerm: list.map((x) => ({ '@type': 'DefinedTerm', name: x.term, description: strip(x.html), url: `${abs('/glossary/')}#${x.id}`, inDefinedTermSet: { '@id': `${abs('/glossary/')}#terms` } })) }, breadcrumbs([['Home', '/'], ['Glossary', '/glossary/']])],
    lastmod: newest(entries),
    og: { kind: 'page', title: 'Terminal email glossary', text: 'IMAP, Maildir, JMAP, OAuth2, STARTTLS and more' }
  });
}

const glossaryMd = () => `# Terminal email glossary

${terms()
  .map((x) => `## ${x.term}\n\n${strip(x.html)}`)
  .join('\n\n')}
`;

// The guide pages, for build.js, llms.txt and the search index.
const GUIDES = [
  { path: '/best/', title: 'Best terminal email clients by need', description: 'One pick for each common need, with the facts behind it.', html: bestPage, md: bestMd },
  { path: '/faq/', title: 'Terminal email questions and answers', description: 'Short answers about clients, syncing, sending, OAuth2, Windows and Android.', html: faqPage, md: faqMd },
  { path: '/glossary/', title: 'Terminal email glossary', description: 'IMAP, POP3, SMTP, JMAP, Maildir, notmuch, OAuth2, OpenPGP and other terms.', html: glossaryPage, md: glossaryMd }
];

module.exports = { GUIDES, PICKS, picks, faqList, terms, bestPage, faqPage, glossaryPage, bestMd, faqMd, glossaryMd };
