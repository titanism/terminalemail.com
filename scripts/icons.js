'use strict';

// Generates every icon from one logo definition, so the favicon, app icons and header logo match.
// Usage: npm run icons   (writes files into site/, which are committed)
//
//   favicon.svg             The amber prompt tile, the same in light and dark browser themes
//   favicon.ico             16, 32 and 48 px, for browsers and tools that ask for /favicon.ico
//   favicon-16.png, favicon-32.png
//   apple-touch-icon.png    180 px, full bleed (iOS rounds the corners itself)
//   icon-192.png, icon-512.png            Rounded, transparent corners ("any")
//   icon-maskable-192.png, icon-maskable-512.png  Full bleed with the logo inside the safe zone
//   safari-pinned-tab.svg   Single-color mask icon

const fs = require('node:fs');
const path = require('node:path');


const OUT = path.join(__dirname, '..', 'site');
// Amber CRT tile with a terminal prompt: the same mark in every size.
const LIGHT = { bg: '#15110b', fg: '#ffb000', frame: '#f2e3c6' };
const DARK = LIGHT;

// The prompt (">" and "_") on a 32 x 32 grid.
const CHEVRON = 'M9 11l6 5-6 5';
const UNDERSCORE = 'M17 22h7';

// `scale` shrinks the mark inside the tile (maskable icons need a safe zone).
function mark({ bg, fg, frame, rx = 7, scale = 1, strokeWidth = 2.6 }) {
  const t = 16 - 16 * scale;
  return `<rect width="32" height="32" rx="${rx}" fill="${bg}"/>
<g transform="translate(${t} ${t}) scale(${scale})" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${CHEVRON}" stroke="${fg}" stroke-width="${strokeWidth}"/><path d="${UNDERSCORE}" stroke="${frame}" stroke-width="${strokeWidth}"/></g>`;
}

const svg = (inner, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">${inner}</svg>`;

function favicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
${mark(LIGHT)}
</svg>
`;
}

function png(inner, size) {
  // Thicker strokes at tiny sizes keep the check readable.
  const { Resvg } = require('@resvg/resvg-js');
  return new Resvg(svg(inner, size), { fitTo: { mode: 'width', value: size } }).render().asPng();
}

// ICO container holding PNG images (supported by every browser since Internet Explorer 9).
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...images.map((x) => x.data)]);
}

function main() {
  const write = (name, data) => fs.writeFileSync(path.join(OUT, name), data);
  write('favicon.svg', favicon());
  write('safari-pinned-tab.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${CHEVRON}"/><path d="${UNDERSCORE}"/></g></svg>\n`);
  const small = (s) => mark({ ...LIGHT, strokeWidth: s <= 16 ? 3.4 : s <= 32 ? 3 : 2.6 });
  const sizes = [16, 32, 48].map((size) => ({ size, data: png(small(size), size) }));
  write('favicon.ico', ico(sizes));
  write('favicon-16.png', sizes[0].data);
  write('favicon-32.png', sizes[1].data);
  write('apple-touch-icon.png', png(mark({ ...LIGHT, rx: 0, scale: 0.86 }), 180));
  for (const s of [192, 512]) {
    write(`icon-${s}.png`, png(mark(LIGHT), s));
    write(`icon-maskable-${s}.png`, png(mark({ ...LIGHT, rx: 0, scale: 0.72 }), s));
  }
  console.log('Icons written to site/');
}

if (require.main === module) main();

module.exports = { CHEVRON, UNDERSCORE, LIGHT, DARK, mark };
