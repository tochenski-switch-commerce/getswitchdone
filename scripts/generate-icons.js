/**
 * Generate PWA icons for GSD Boards.
 * Run: node scripts/generate-icons.js
 *
 * Creates PNG icons using a raw-pixel approach (no native deps).
 * For production, replace these with professionally designed icons.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

// Simple PNG encoder (no dependencies)
function createPNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA, row by row

  // Build raw scanlines (filter 0 = None)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter byte
    pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeInt32BE(crc32(crcData), 0);
    return Buffer.concat([len, typeBuffer, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// CRC32 for PNG chunks
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return crc ^ -1;
}

// Draw a simple GSD icon: dark background with a stylized "G" / kanban grid
function drawIcon(size, maskable) {
  const pixels = Buffer.alloc(size * size * 4);
  const bg = { r: 15, g: 17, b: 23 };       // #0f1117
  const accent = { r: 129, g: 140, b: 248 }; // #818cf8 (indigo)
  const white = { r: 249, g: 250, b: 251 };   // #f9fafb

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = a;
  }

  function fillRect(x1, y1, w, h, color) {
    for (let y = y1; y < y1 + h && y < size; y++)
      for (let x = x1; x < x1 + w && x < size; x++)
        setPixel(x, y, color.r, color.g, color.b);
  }

  function fillCircle(cx, cy, r, color) {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r)
          setPixel(x, y, color.r, color.g, color.b);
  }

  function fillRoundRect(x1, y1, w, h, radius, color) {
    // Fill center rectangle
    fillRect(x1 + radius, y1, w - 2 * radius, h, color);
    fillRect(x1, y1 + radius, w, h - 2 * radius, color);
    // Fill corners
    fillCircle(x1 + radius, y1 + radius, radius, color);
    fillCircle(x1 + w - radius - 1, y1 + radius, radius, color);
    fillCircle(x1 + radius, y1 + h - radius - 1, radius, color);
    fillCircle(x1 + w - radius - 1, y1 + h - radius - 1, radius, color);
  }

  // Fill background
  fillRect(0, 0, size, size, bg);

  // For maskable, the safe zone is the inner 80% (10% padding each side)
  const padding = maskable ? Math.round(size * 0.15) : Math.round(size * 0.1);
  const area = size - padding * 2;

  // Draw 3 kanban columns with cards
  const colW = Math.round(area / 3.6);
  const gap = Math.round(area * 0.05);
  const cardR = Math.max(2, Math.round(size * 0.02));
  const colStartX = padding + Math.round((area - (colW * 3 + gap * 2)) / 2);
  const colStartY = padding + Math.round(area * 0.15);
  const colH = Math.round(area * 0.7);

  // Column header dots
  const dotR = Math.max(2, Math.round(size * 0.015));
  const colors = [
    { r: 129, g: 140, b: 248 }, // indigo
    { r: 251, g: 191, b: 36 },  // amber
    { r: 52, g: 211, b: 153 },  // emerald
  ];

  // Card heights for each column
  const cardSets = [
    [0.22, 0.18, 0.15],  // col 1: 3 cards
    [0.28, 0.2],          // col 2: 2 cards
    [0.35],               // col 3: 1 card
  ];

  for (let col = 0; col < 3; col++) {
    const cx = colStartX + col * (colW + gap);

    // Column background
    const colBg = { r: 22, g: 24, b: 33 }; // slightly lighter than bg
    fillRoundRect(cx, colStartY, colW, colH, cardR * 2, colBg);

    // Header dot
    fillCircle(cx + Math.round(colW * 0.15), colStartY + Math.round(area * 0.04), dotR, colors[col]);

    // Header line (title placeholder)
    const lineY = colStartY + Math.round(area * 0.025);
    const lineH = Math.max(2, Math.round(size * 0.012));
    fillRoundRect(
      cx + Math.round(colW * 0.28),
      lineY,
      Math.round(colW * 0.5),
      lineH,
      Math.round(lineH / 2),
      { r: 55, g: 58, b: 72 }
    );

    // Cards
    const cardPad = Math.round(colW * 0.1);
    let cardY = colStartY + Math.round(area * 0.09);
    for (const cardH of cardSets[col]) {
      const ch = Math.round(colH * cardH);
      fillRoundRect(cx + cardPad, cardY, colW - cardPad * 2, ch, cardR, { r: 30, g: 33, b: 44 });

      // Small line inside card (text placeholder)
      const textY = cardY + Math.round(ch * 0.3);
      const textH = Math.max(2, Math.round(size * 0.01));
      fillRoundRect(
        cx + cardPad + Math.round(colW * 0.08),
        textY,
        Math.round((colW - cardPad * 2) * 0.65),
        textH,
        1,
        { r: 156, g: 163, b: 175 }
      );

      cardY += ch + Math.round(colH * 0.04);
    }
  }

  // Title at top: "GSD" text as rounded rects
  const titleY = padding + Math.round(area * 0.02);
  const letterH = Math.max(4, Math.round(size * 0.05));
  const letterW = Math.max(8, Math.round(size * 0.08));
  const letterGap = Math.round(size * 0.02);
  const totalLettersW = letterW * 3 + letterGap * 2;
  const titleX = Math.round((size - totalLettersW) / 2);

  // Draw "GSD" as three accent-colored rounded rects
  for (let i = 0; i < 3; i++) {
    fillRoundRect(titleX + i * (letterW + letterGap), titleY, letterW, letterH, Math.round(letterH / 3), accent);
  }

  return createPNG(size, size, pixels);
}

// Generate all icons
const specs = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-192.png', size: 192, maskable: true },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
  { name: 'favicon-32.png', size: 32, maskable: false },
  { name: 'favicon-16.png', size: 16, maskable: false },
];

fs.mkdirSync(ICONS_DIR, { recursive: true });

for (const spec of specs) {
  const png = drawIcon(spec.size, spec.maskable);
  const filepath = path.join(ICONS_DIR, spec.name);
  fs.writeFileSync(filepath, png);
  console.log(`✓ ${spec.name} (${spec.size}×${spec.size})`);
}

console.log('\nDone! Icons generated in public/icons/');
