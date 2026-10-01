'use strict';

// Social images (Open Graph and X cards), 1200 x 630 PNG, drawn as a terminal window in the
// site's amber CRT colors. Rendered with resvg from SVG, using the fonts in assets/fonts (no
// system fonts), cached by content in .cache/og so unchanged pages are not rendered again.
//
// Both fonts are monospaced, so text is measured exactly: VT323 is 0.4 em per character and
// IBM Plex Mono 0.6 em.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ROOT, OSES } = require('./lib');

const W = 1200;
const H = 630;
const CACHE = path.join(ROOT, '.cache', 'og');
const FONTS = path.join(ROOT, 'assets', 'fonts');
const VERSION = 'te-og-1';
const BATCH = 80;

const C = {
  bg: '#15110b',
  panel: '#1d1810',
  bar: '#251e14',
  line: '#382d1d',
  lineStrong: '#56452b',
  ink: '#f2e3c6',
  muted: '#b8a17d',
  amber: '#ffb000',
  amberInk: '#1a1206'
};
const DISPLAY = 'VT323';
const MONO = 'IBM Plex Mono';
const ADVANCE = { [DISPLAY]: 0.4, [MONO]: 0.6 };

// Also drops characters that are not allowed in XML, which would stop the image from rendering.
const esc = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const width = (text, size, family) => [...String(text)].length * size * ADVANCE[family];

// Greedy word wrap. Returns null when the text needs more than maxLines at this size.
function wrap(text, size, max, maxLines, family) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (width(next, size, family) <= max || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length <= maxLines && lines.every((l) => width(l, size, family) <= max) ? lines : null;
}

// Largest size from `sizes` that fits; the smallest size is cut with an ellipsis.
function fit(text, sizes, max, maxLines, family) {
  for (const size of sizes) {
    const lines = wrap(text, size, max, maxLines, family);
    if (lines) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  const words = String(text).split(/\s+/);
  let lines = null;
  for (let n = words.length - 1; n > 0 && !lines; n--) lines = wrap(`${words.slice(0, n).join(' ')}…`, size, max, maxLines, family);
  return { size, lines: lines || [String(text).slice(0, Math.floor(max / (size * ADVANCE[family])) - 1) + '…'] };
}

const text = (lines, x, y, size, { family = MONO, fill = C.ink, weight = 400, lh = 1.25 } = {}) => lines.map((l, i) => `<text x="${x}" y="${y + i * size * lh}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(l)}</text>`).join('');

// The terminal window every card is drawn in.
function frame(inner, { command, foot = 'Made by Forward Email' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000000" fill-opacity="0.18"/></pattern>
<radialGradient id="glow" cx="0.3" cy="0.35" r="0.9"><stop offset="0" stop-color="${C.amber}" stop-opacity="0.07"/><stop offset="1" stop-color="${C.amber}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="14" fill="${C.panel}" stroke="${C.lineStrong}" stroke-width="2"/>
<path d="M30 76H${W - 30}" stroke="${C.line}" stroke-width="2"/>
<path d="M42 30H${W - 42}a12 12 0 0 1 12 12V75H30V42a12 12 0 0 1 12-12z" fill="${C.bar}"/>
<circle cx="62" cy="53" r="7" fill="none" stroke="${C.lineStrong}" stroke-width="2"/><circle cx="88" cy="53" r="7" fill="none" stroke="${C.lineStrong}" stroke-width="2"/><circle cx="114" cy="53" r="7" fill="none" stroke="${C.lineStrong}" stroke-width="2"/>
<text x="${W / 2}" y="60" text-anchor="middle" font-family="${MONO}" font-size="20" fill="${C.muted}">terminalemail.com</text>
<rect x="30" y="77" width="${W - 60}" height="${H - 107}" fill="url(#glow)"/>
${command ? `<text x="72" y="134" font-family="${MONO}" font-size="24" fill="${C.muted}"><tspan fill="${C.amber}">$</tspan> ${esc(command)}</text>` : ''}
${inner}
<path d="M72 ${H - 108}H${W - 72}" stroke="${C.line}" stroke-width="2" stroke-dasharray="6 6"/>
<g transform="translate(72 ${H - 92}) scale(1.25)"><rect x="2.5" y="4.5" width="27" height="23" rx="3.5" fill="none" stroke="${C.ink}" stroke-width="2"/><path d="M8.5 12.5l5 3.5-5 3.5" fill="none" stroke="${C.amber}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 21h7.5" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/></g>
<text x="122" y="${H - 58}" font-family="${DISPLAY}" font-size="40" fill="${C.ink}">Terminal Email</text>
<text x="${W - 72}" y="${H - 60}" text-anchor="end" font-family="${MONO}" font-size="20" fill="${C.muted}">${esc(foot)}</text>
<rect width="${W}" height="${H}" fill="url(#scan)"/>
</svg>`;
}

// Five boxes, one per system: filled for native, dashed for WSL/Termux/source, faint for none.
function osRow(e, x, y) {
  return OSES.map((o, i) => {
    const s = e.platforms[o.id].support;
    const bx = x + i * 98;
    if (s === 'native') return `<rect x="${bx}" y="${y}" width="86" height="44" rx="4" fill="${C.amber}"/><text x="${bx + 43}" y="${y + 30}" text-anchor="middle" font-family="${MONO}" font-weight="600" font-size="20" fill="${C.amberInk}">${o.short}</text>`;
    if (s === 'none') return `<rect x="${bx + 1}" y="${y + 1}" width="84" height="42" rx="4" fill="none" stroke="${C.line}" stroke-width="2"/><text x="${bx + 43}" y="${y + 30}" text-anchor="middle" font-family="${MONO}" font-size="20" fill="${C.lineStrong}">${o.short}</text>`;
    return `<rect x="${bx + 1}" y="${y + 1}" width="84" height="42" rx="4" fill="none" stroke="${C.amber}" stroke-width="2" stroke-dasharray="6 4"/><text x="${bx + 43}" y="${y + 30}" text-anchor="middle" font-family="${MONO}" font-size="20" fill="${C.amber}">${o.short}</text>`;
  }).join('');
}

function entrySvg({ entry: e }) {
  const t = fit(e.name, [132, 112, 96, 80], W - 144, 1, DISPLAY);
  const s = fit(e.summary, [28, 26, 24], W - 144, 3, MONO);
  const yTitle = 150 + t.size * 0.72;
  const ySum = yTitle + 48;
  const sumEnd = ySum + (s.lines.length - 1) * s.size * 1.3;
  return frame(
    `${text(t.lines, 70, yTitle, t.size, { family: DISPLAY, fill: C.amber })}
${text(s.lines, 72, ySum, s.size, { lh: 1.3 })}
${osRow(e, 72, Math.min(sumEnd + 34, H - 176))}`,
    { command: `terminalemail show ${e.slug}`, foot: `${e.featured ? 'Featured' : e.type === 'tool' ? 'Mail tool' : 'Terminal email client'}` }
  );
}

function listSvg({ title, list = [], os }) {
  const t = fit(title, [96, 84, 72, 60], W - 144, 2, DISPLAY);
  const yTitle = 150 + t.size * 0.72;
  const after = yTitle + (t.lines.length - 1) * t.size * 0.95 + 56;
  const names = list.map((e) => e.name);
  const line = fit(names.join(', '), [26, 24, 22], W - 144, 2, MONO);
  return frame(`${text(t.lines, 70, yTitle, t.size, { family: DISPLAY, fill: C.amber, lh: 0.95 })}${text(line.lines, 72, after, line.size, { fill: C.ink, lh: 1.35 })}`, { command: `terminalemail --list${os ? ` --os=${os}` : ''}`, foot: `${list.length} ${list.length === 1 ? 'entry' : 'entries'}` });
}

function compareSvg({ a, b }) {
  const half = (W - 144 - 60) / 2;
  const ta = fit(a.name, [104, 88, 72, 60], half, 1, DISPLAY);
  const tb = fit(b.name, [104, 88, 72, 60], half, 1, DISPLAY);
  const size = Math.min(ta.size, tb.size);
  const y = 230;
  return frame(
    `${text(fit(a.name, [size], half, 1, DISPLAY).lines, 70, y, size, { family: DISPLAY, fill: C.amber })}
<text x="${W / 2}" y="${y - 8}" text-anchor="middle" font-family="${MONO}" font-size="28" fill="${C.muted}">vs</text>
<text x="${W - 70}" y="${y}" text-anchor="end" font-family="${DISPLAY}" font-size="${size}" fill="${C.amber}">${esc(fit(b.name, [size], half, 1, DISPLAY).lines[0])}</text>
${osRow(a, 72, 300)}
<g transform="translate(${W - 72 - 4 * 98 - 86} 0)">${osRow(b, 0, 300)}</g>
${text(fit(`${a.interface.toUpperCase()}, ${a.language}`, [22], half, 1, MONO).lines, 72, 390, 22, { fill: C.muted })}
<text x="${W - 72}" y="390" text-anchor="end" font-family="${MONO}" font-size="22" fill="${C.muted}">${esc(fit(`${b.interface.toUpperCase()}, ${b.language}`, [22], half, 1, MONO).lines[0])}</text>`,
    { command: `terminalemail compare ${a.slug} ${b.slug}`, foot: 'Side by side' }
  );
}

function pageSvg({ title, text: body }) {
  const t = fit(title, [104, 92, 80, 68], W - 144, 2, DISPLAY);
  const yTitle = 150 + t.size * 0.72;
  const after = yTitle + (t.lines.length - 1) * t.size * 0.95 + 56;
  const d = body ? fit(body, [28, 26, 24], W - 144, 2, MONO) : null;
  return frame(`${text(t.lines, 70, yTitle, t.size, { family: DISPLAY, fill: C.amber, lh: 0.95 })}${d ? text(d.lines, 72, after, d.size, { lh: 1.3 }) : ''}`, { command: 'terminalemail --help' });
}

function homeSvg({ clients }) {
  const t = fit('Terminal email clients for every system', [96, 88], W - 144, 2, DISPLAY);
  const yTitle = 150 + t.size * 0.72;
  return frame(
    `${text(t.lines, 70, yTitle, t.size, { family: DISPLAY, fill: C.amber, lh: 0.95 })}
${text([`Linux  macOS  Windows  BSD  Android`], 72, yTitle + t.size * 0.95 + 64, 28, { fill: C.ink })}
${text([`${clients.length} clients, install commands, Forward Email configs`], 72, yTitle + t.size * 0.95 + 110, 24, { fill: C.muted })}`,
    { command: 'terminalemail --list --os=any' }
  );
}

function svgFor(spec) {
  if (spec.kind === 'entry') return entrySvg(spec);
  if (spec.kind === 'list') return listSvg(spec);
  if (spec.kind === 'compare') return compareSvg(spec);
  if (spec.kind === 'home') return homeSvg(spec);
  return pageSvg(spec);
}

// ---------- rendering ----------

let fontFiles = null;
function render(svg) {
  const { Resvg } = require('@resvg/resvg-js');
  const UPNG = require('upng-js');
  fontFiles ||= fs.readdirSync(FONTS).filter((f) => f.endsWith('.ttf')).map((f) => path.join(FONTS, f));
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { fontFiles, loadSystemFonts: false, defaultFontFamily: MONO } }).render();
  const px = img.pixels;
  // A 256-color palette keeps each image small with no visible loss.
  return Buffer.from(UPNG.encode([px.buffer.slice(px.byteOffset, px.byteOffset + px.byteLength)], img.width, img.height, 256));
}

const keyFor = (svg) => crypto.createHash('sha256').update(VERSION).update(svg).digest('hex').slice(0, 32);

// Renders every job into outDir, using the cache and one worker per CPU for new images.
async function renderAll(jobs, outDir) {
  fs.mkdirSync(CACHE, { recursive: true });
  const todo = new Map();
  const planned = jobs.map(({ file, spec }) => {
    const svg = svgFor(spec);
    const key = keyFor(svg);
    if (!fs.existsSync(path.join(CACHE, `${key}.png`))) todo.set(key, svg);
    return { file, key };
  });

  if (todo.size) {
    // resvg-js holds on to native memory after each render, so each worker renders a batch
    // and exits, which returns the memory. Workers run in parallel, one per CPU.
    const { Worker } = require('node:worker_threads');
    const items = [...todo];
    const batches = [];
    for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));
    const run = (part) =>
      new Promise((resolve, reject) => {
        const w = new Worker(__filename, { workerData: { part, cache: CACHE } });
        w.on('error', reject);
        w.on('exit', (code) => (code ? reject(new Error(`OG worker exited with code ${code}`)) : resolve()));
      });
    const lanes = Math.max(1, Math.min(require('node:os').cpus().length, batches.length));
    let next = 0;
    await Promise.all(
      Array.from({ length: lanes }, async () => {
        while (next < batches.length) await run(batches[next++]);
      })
    );
  }

  for (const { file, key } of planned) {
    const out = path.join(outDir, file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(path.join(CACHE, `${key}.png`), out);
  }

  // Drop cached images no page uses any more.
  const used = new Set(planned.map((p) => `${p.key}.png`));
  for (const f of fs.readdirSync(CACHE)) if (!used.has(f)) fs.rmSync(path.join(CACHE, f));
  return { total: jobs.length, rendered: todo.size };
}

const { isMainThread, workerData } = require('node:worker_threads');
if (!isMainThread && workerData?.part) {
  for (const [key, svg] of workerData.part) fs.writeFileSync(path.join(workerData.cache, `${key}.png`), render(svg));
}

module.exports = { svgFor, render, renderAll, W, H };
