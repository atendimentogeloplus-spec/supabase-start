'use strict';

// Gera os icones PNG do PWA sem depender de bibliotecas externas.
// Uso: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.resolve(__dirname, '..', 'public', 'assets', 'icons');
const SUPERSAMPLE = 4;

const BRAND_TOP = [99, 102, 241];    // #6366f1
const BRAND_BOTTOM = [67, 56, 202];  // #4338ca
const BAR_COLOR = [255, 255, 255];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function insideRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function fillRectHi(px, sizeHi, x0, y0, x1, y1, r, color) {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(sizeHi, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(sizeHi, Math.ceil(x1)); x++) {
      if (!insideRoundedRect(x + 0.5, y + 0.5, x0, y0, x1, y1, r)) continue;
      const i = (y * sizeHi + x) * 4;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = 255;
    }
  }
}

function renderIcon(size, { maskable = false, rounded = true } = {}) {
  const hi = size * SUPERSAMPLE;
  const buf = new Uint8Array(hi * hi * 4);

  const radius = rounded ? hi * 0.22 : 0;
  for (let y = 0; y < hi; y++) {
    const t = y / (hi - 1);
    const color = [
      Math.round(BRAND_TOP[0] + (BRAND_BOTTOM[0] - BRAND_TOP[0]) * t),
      Math.round(BRAND_TOP[1] + (BRAND_BOTTOM[1] - BRAND_TOP[1]) * t),
      Math.round(BRAND_TOP[2] + (BRAND_BOTTOM[2] - BRAND_TOP[2]) * t)
    ];
    for (let x = 0; x < hi; x++) {
      const inside = maskable || !rounded
        ? true
        : insideRoundedRect(x + 0.5, y + 0.5, 0, 0, hi, hi, radius);
      if (!inside) continue;
      const i = (y * hi + x) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 255;
    }
  }

  const bars = [
    { center: 0.32, height: 0.30 },
    { center: 0.50, height: 0.44 },
    { center: 0.68, height: 0.37 }
  ];
  const barWidth = 0.105;
  const bottom = 0.72;

  for (const bar of bars) {
    const x0 = (bar.center - barWidth / 2) * hi;
    const x1 = (bar.center + barWidth / 2) * hi;
    const y1 = bottom * hi;
    const y0 = (bottom - bar.height) * hi;
    fillRectHi(buf, hi, x0, y0, x1, y1, (barWidth * hi) / 2, BAR_COLOR);
  }

  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const hx = x * SUPERSAMPLE + sx;
          const hy = y * SUPERSAMPLE + sy;
          const i = (hy * hi + hx) * 4;
          const alpha = buf[i + 3] / 255;
          r += buf[i] * alpha;
          g += buf[i + 1] * alpha;
          b += buf[i + 2] * alpha;
          a += buf[i + 3];
        }
      }
      const samples = SUPERSAMPLE * SUPERSAMPLE;
      const alphaOut = a / samples;
      const o = (y * size + x) * 4;
      if (alphaOut > 0) {
        const alphaFrac = alphaOut / 255;
        out[o] = Math.min(255, Math.round(r / samples / alphaFrac));
        out[o + 1] = Math.min(255, Math.round(g / samples / alphaFrac));
        out[o + 2] = Math.min(255, Math.round(b / samples / alphaFrac));
      }
      out[o + 3] = Math.round(alphaOut);
    }
  }

  return encodePng(size, size, out);
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, opts: { rounded: true } },
  { file: 'icon-512.png', size: 512, opts: { rounded: true } },
  { file: 'icon-maskable-512.png', size: 512, opts: { maskable: true, rounded: false } },
  { file: 'apple-touch-icon.png', size: 180, opts: { maskable: true, rounded: false } },
  { file: 'favicon-32.png', size: 32, opts: { rounded: true } }
];

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const target of TARGETS) {
    const png = renderIcon(target.size, target.opts);
    fs.writeFileSync(path.join(OUT_DIR, target.file), png);
    console.log(`  ${target.file.padEnd(26)} ${target.size}x${target.size}  ${png.length} bytes`);
  }
  console.log(`\nIcones gerados em ${path.relative(process.cwd(), OUT_DIR)}`);
}

if (require.main === module) main();

module.exports = { renderIcon, encodePng };
