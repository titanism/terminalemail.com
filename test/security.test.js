'use strict';

// Untrusted input is data files and Markdown from contributors. These tests check it cannot
// become markup, scripts or unsafe links.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const T = require('../scripts/templates');
const P = require('../scripts/pages');
const ctx = require('../scripts/context');
const { validateClient, readYaml } = require('../scripts/lib');

const OUT = path.join(__dirname, '..', '_site');
const htmlFiles = () => fs.readdirSync(OUT, { recursive: true }).map(String).filter((f) => f.endsWith('.html'));
const valid = () => structuredClone(readYaml(path.join(__dirname, '..', 'clients', 'neomutt.yml')));

test('Markdown shows raw HTML as text and drops unsafe links', () => {
  const html = T.md('<script>alert(1)</script>\n\n[x](javascript:alert(1)) [y](JaVaScRiPt:alert(1)) [z](data:text/html,hi) [ok](https://example.com) [rel](/about/)');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!/href="(javascript|data):/i.test(html));
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(html.includes('rel="noopener"'));
  assert.ok(html.includes('href="/about/"'));
});

test('Markdown images from other sites become links, and alt text cannot break out', () => {
  const html = T.md('![a" onerror="x](https://evil.example/x.png) ![b" onload="y](/local.png)');
  assert.ok(!html.includes('<img src="https://evil.example'));
  assert.ok(!html.includes(' onerror="x"') && !html.includes(' onload="y"'));
});

test('only http(s) URLs from data become links', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.example', 'ftp://x', 'https://a b', 'https://x"onmouseover="y', '', null]) assert.strictEqual(T.httpUrl(bad), null, String(bad));
  assert.strictEqual(T.httpUrl('https://neomutt.org/'), 'https://neomutt.org/');
});

test('validation accepts a real record and rejects unsafe or incomplete data', () => {
  assert.deepStrictEqual(validateClient(valid()), []);
  const cases = [
    [(c) => (c.summary = 'Hi <img src=x onerror=alert(1)>'), /summary must not contain HTML/],
    [(c) => (c.website = 'javascript:alert(1)'), /website must be an http\(s\) URL/],
    [(c) => (c.platforms.linux.support = 'maybe'), /platforms\.linux\.support/],
    [(c) => delete c.platforms.android, /platforms\.android is required/],
    [(c) => (c.platforms.bsd = { support: 'none', install: [{ via: 'pkg', cmd: 'pkg install x' }] }), /unsupported system/],
    [(c) => (c.platforms.linux.support = 'wsl'), /wsl is only for Windows/],
    [(c) => (c.license = 'WTFPL-ish'), /license must be a known SPDX/],
    [(c) => (c.protocols.imap = 'yes'), /protocols\.imap/],
    [(c) => (c.pros = ['only one']), /pros needs at least two/],
    [(c) => (c.sources = ['not a url']), /sources must list/],
    [(c) => (c.slug = 'Bad Slug'), /slug must be lowercase/],
    [(c) => (c.platforms.linux.install = [{ via: 'apt', cmd: 'a\nrm -rf /' }]), /must be one line/],
    [(c) => (c.description = 'TODO write this'), /placeholder/]
  ];
  for (const [change, msg] of cases) {
    const c = valid();
    change(c);
    const errors = validateClient(c).join('\n');
    assert.match(errors, msg);
  }
});

test('an entry page escapes hostile fields that slip past validation', () => {
  const real = ctx.bySlug.get('neomutt');
  const evil = { ...real, name: 'X"><script>alert(1)</script>', summary: '<img src=x onerror=alert(2)>', pros: ['<b>bold</b>', 'ok'], forward_email: '</code><script>alert(3)</script>', sources: ['javascript:alert(4)', 'https://example.com/'] };
  const html = P.entryPage(evil);
  assert.ok(!html.includes('<script>alert'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<b>bold</b>'));
  assert.ok(!html.includes('href="javascript:'));
});

test('the Content Security Policy allows exactly the inline script on each page', () => {
  const hash = `'sha256-${crypto.createHash('sha256').update(T.THEME_SCRIPT, 'utf8').digest('base64')}'`;
  for (const f of htmlFiles()) {
    const html = fs.readFileSync(path.join(OUT, f), 'utf8');
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    assert.ok(csp, `${f}: no CSP`);
    assert.ok(csp.includes(hash), `${f}: theme script hash missing`);
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.deepStrictEqual(inline, [T.THEME_SCRIPT], `${f}: unexpected inline scripts`);
    assert.ok(!/\sstyle="/.test(html), `${f}: inline style attribute (blocked by the CSP)`);
    assert.ok(!/\son[a-z]+="/.test(html), `${f}: inline event handler`);
  }
});

test('links to other sites open safely', () => {
  for (const f of htmlFiles()) {
    const html = fs.readFileSync(path.join(OUT, f), 'utf8');
    for (const [tag] of html.matchAll(/<a [^>]*href="https?:\/\/(?!terminalemail\.com)[^"]*"[^>]*>/g)) {
      if (/target="_blank"/.test(tag)) assert.match(tag, /rel="[^"]*noopener/, `${f}: ${tag}`);
    }
  }
});

test('JSON-LD cannot close its script element', () => {
  for (const f of htmlFiles()) {
    const html = fs.readFileSync(path.join(OUT, f), 'utf8');
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.ok(!json.includes('<'), `${f}: raw < in JSON-LD`);
      JSON.parse(json);
    }
  }
});
