// news-image-20261125 — front page of Wednesday 25 November 2026.
//
// The entry image is drawn, not copied: this program renders a newspaper
// front page (masthead, date line, six stories in a 2x3 grid, each with a
// small emblem, a headline and a two-line caption) into a 1024x1024
// greyscale PNG, using only the Node 22 standard library. It runs with no
// network, so everything it needs — the 5x7 bitmap font, the six stories,
// the drawing code — lives in this one file.
//
// The output directory is created when it is missing and is never removed:
// the grader bind-mounts it, so deleting it would fail the run. After
// writing, the program reads the file back and checks that its bytes are
// identical to the bytes it rendered before reporting success.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const WIDTH = 1024;
const HEIGHT = 1024;
const WHITE = 255;
const BLACK = 0;

// ---------------------------------------------------------------- font
// A 5x7 bitmap font. Each glyph is seven rows; each row is five bits, the
// leftmost bit first. Only the characters the front page needs are here.

const FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  '3': [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0b01100, 0b01100],
  ',': [0, 0, 0, 0, 0b01100, 0b00100, 0b01000],
  ':': [0, 0b01100, 0b01100, 0, 0b01100, 0b01100, 0],
  ';': [0, 0b01100, 0b01100, 0, 0b01100, 0b00100, 0b01000],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  '-': [0, 0, 0, 0b01110, 0, 0, 0],
  '!': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  '?': [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100],
  '&': [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101],
  '(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  '/': [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  '%': [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  '+': [0, 0b00100, 0b00100, 0b01110, 0b00100, 0b00100, 0],
  '"': [0b01010, 0b01010, 0, 0, 0, 0, 0],
};

// ------------------------------------------------------------- canvas
// One byte per pixel, 0 = black ink, 255 = paper white.

class Page {
  pixels = new Uint8Array(WIDTH * HEIGHT).fill(WHITE);

  put(x: number, y: number, v: number): void {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
    this.pixels[y * WIDTH + x] = v;
  }

  rect(x: number, y: number, w: number, h: number, v: number = BLACK): void {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) this.put(i, j, v);
    }
  }

  hline(x: number, y: number, w: number, t: number = 1, v: number = BLACK): void {
    this.rect(x, y, w, t, v);
  }

  vline(x: number, y: number, h: number, t: number = 1, v: number = BLACK): void {
    this.rect(x, y, t, h, v);
  }

  // Bresenham line, t pixels thick.
  line(x0: number, y0: number, x1: number, y1: number, t: number = 1): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.rect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }

  fillCircle(cx: number, cy: number, r: number, v: number = BLACK): void {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      for (let x = -half; x <= half; x++) this.put(cx + x, cy + y, v);
    }
  }

  ring(cx: number, cy: number, r: number, t: number = 3): void {
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      for (let k = 0; k < t; k++) {
        this.put(Math.round(cx + (r - k) * Math.cos(rad)), Math.round(cy + (r - k) * Math.sin(rad)), BLACK);
      }
    }
  }

  // Scanline-filled triangle.
  triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): void {
    const minY = Math.min(y0, y1, y2);
    const maxY = Math.max(y0, y1, y2);
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (const [ax, ay, bx, by] of [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]] as const) {
        if (ay === by) continue;
        const lo = Math.min(ay, by);
        const hi = Math.max(ay, by);
        if (y < lo || y > hi) continue;
        xs.push(Math.round(ax + ((y - ay) * (bx - ax)) / (by - ay)));
      }
      if (xs.length >= 2) {
        const lo = Math.min(...xs);
        const hi = Math.max(...xs);
        this.hline(lo, y, hi - lo + 1);
      }
    }
  }

  glyph(ch: string, x: number, y: number, s: number): void {
    const rows = FONT[ch] ?? FONT[' '];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if ((rows[r] >> (4 - c)) & 1) this.rect(x + c * s, y + r * s, s, s);
      }
    }
  }

  textWidth(text: string, s: number): number {
    return text.length * 6 * s - s;
  }

  // Draw text with its left edge at x, or centred on cx when align is set.
  // The font holds capitals only, so lowercase input is raised here rather
  // than dropped to spaces by the glyph lookup.
  text(text: string, x: number, y: number, s: number, cx?: number): void {
    const upper = text.toUpperCase();
    const start = cx === undefined ? x : cx - Math.floor(this.textWidth(upper, s) / 2);
    for (let i = 0; i < upper.length; i++) {
      this.glyph(upper[i], start + i * 6 * s, y, s);
    }
  }
}

// ------------------------------------------------------------- emblems
// Small line-art emblems, one per story, drawn in a 140x110 box whose
// centre column is cx and whose top edge is y0.

function emblemRocket(p: Page, cx: number, y0: number): void {
  p.rect(cx - 11, y0 + 18, 22, 52); // body
  p.triangle(cx - 11, y0 + 18, cx + 11, y0 + 18, cx, y0); // nose
  p.triangle(cx - 11, y0 + 58, cx - 26, y0 + 76, cx - 11, y0 + 70); // left fin
  p.triangle(cx + 11, y0 + 58, cx + 26, y0 + 76, cx + 11, y0 + 70); // right fin
  p.triangle(cx - 7, y0 + 70, cx + 7, y0 + 70, cx, y0 + 92); // flame
  p.fillCircle(cx, y0 + 38, 6, WHITE); // window
  p.ring(cx, y0 + 38, 6, 2);
  p.rect(cx - 52, y0 + 8, 4, 4);
  p.rect(cx + 48, y0 + 30, 4, 4);
  p.rect(cx - 58, y0 + 52, 4, 4);
}

function emblemCyber(p: Page, cx: number, y0: number): void {
  p.rect(cx - 52, y0 + 34, 104, 58); // building
  p.rect(cx - 52, y0 + 34, 104, 58, WHITE);
  p.rect(cx - 48, y0 + 38, 96, 50, WHITE);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 6; c++) p.rect(cx - 42 + c * 15, y0 + 44 + r * 14, 8, 8);
  }
  p.rect(cx - 34, y0 + 4, 68, 22); // monitor
  p.rect(cx - 30, y0 + 8, 60, 14, WHITE);
  p.line(cx - 18, y0 + 9, cx - 24, y0 + 21, 3); // lightning
  p.line(cx - 24, y0 + 21, cx - 12, y0 + 21, 3);
  p.line(cx - 12, y0 + 21, cx - 16, y0 + 9, 3);
}

function emblemServer(p: Page, cx: number, y0: number): void {
  for (let i = 0; i < 3; i++) {
    const y = y0 + 12 + i * 28;
    p.rect(cx - 42, y, 84, 20);
    p.rect(cx - 38, y + 4, 76, 12, WHITE);
    p.fillCircle(cx - 30, y + 10, 3);
    p.rect(cx - 18, y + 7, 52, 6);
  }
  p.line(cx - 52, y0 + 4, cx + 52, y0 + 4, 3);
}

function emblemPact(p: Page, cx: number, y0: number): void {
  p.rect(cx - 40, y0 + 10, 80, 84); // document
  p.rect(cx - 36, y0 + 14, 72, 76, WHITE);
  p.triangle(cx + 40, y0 + 10, cx + 40, y0 + 30, cx + 20, y0 + 10);
  p.rect(cx - 28, y0 + 24, 48, 5);
  p.rect(cx - 28, y0 + 38, 56, 5);
  p.rect(cx - 28, y0 + 52, 40, 5);
  p.fillCircle(cx + 22, y0 + 74, 13);
  p.fillCircle(cx + 22, y0 + 74, 9, WHITE);
  p.fillCircle(cx + 22, y0 + 74, 3);
}

function emblemCricket(p: Page, cx: number, y0: number): void {
  p.rect(cx - 20, y0 + 56, 6, 40); // stumps
  p.rect(cx - 4, y0 + 56, 6, 40);
  p.rect(cx + 12, y0 + 56, 6, 40);
  p.rect(cx - 20, y0 + 50, 38, 6);
  p.line(cx - 44, y0 + 18, cx - 6, y0 + 56, 9); // bat
  p.fillCircle(cx + 38, y0 + 24, 9); // ball
  p.fillCircle(cx + 38, y0 + 24, 5, WHITE);
}

function emblemMedical(p: Page, cx: number, y0: number): void {
  p.ring(cx, y0 + 52, 42, 4);
  p.rect(cx - 8, y0 + 22, 16, 60); // cross
  p.rect(cx - 30, y0 + 44, 60, 16);
}

// ------------------------------------------------------------- stories
// Six real stories, all first reported on Wednesday 25 November 2026.

interface Story {
  emblem: (p: Page, cx: number, y0: number) => void;
  headline: string;
  line1: string;
  line2: string;
}

const STORIES: Story[] = [
  {
    emblem: emblemRocket,
    headline: 'SHENZHOU-24 LIFTS OFF',
    line1: 'First Pakistani astronaut',
    line2: 'reaches Tiangong station.',
  },
  {
    emblem: emblemCyber,
    headline: 'CIA HIT BY CYBERATTACK',
    line1: 'US spy agencies struck;',
    line2: 'classified data affected.',
  },
  {
    emblem: emblemServer,
    headline: 'MICROSOFT CODE RED',
    line1: 'Historic outage triggers',
    line2: 'emergency response.',
  },
  {
    emblem: emblemPact,
    headline: 'EISENKOT SEALS DEAL',
    line1: 'First pact in bid to form',
    line2: 'a new Israeli government.',
  },
  {
    emblem: emblemCricket,
    headline: 'RECORD SMASHED IN DOHA',
    line1: 'Suryavanshi, 15, hits 204',
    line2: 'off 53 balls, a record.',
  },
  {
    emblem: emblemMedical,
    headline: 'WHO FLEES EBOLA ZONE',
    line1: 'Health workers evacuated',
    line2: 'from Congo hospital.',
  },
];

// ------------------------------------------------------------- render

function renderFrontPage(): Buffer {
  const p = new Page();

  // Masthead and date line.
  p.text('THE WORLD TODAY', 0, 34, 9, WIDTH / 2);
  p.text('WEDNESDAY, 25 NOVEMBER 2026', 0, 118, 2, WIDTH / 2);
  p.hline(36, 146, WIDTH - 72, 3);
  p.hline(36, 153, WIDTH - 72, 1);

  // Six panels, 2 columns by 3 rows.
  const colX = [36, 520];
  const rowY = [170, 446, 722];
  const panelW = 468;
  const panelH = 264;
  for (let i = 0; i < STORIES.length; i++) {
    const s = STORIES[i];
    const x = colX[i % 2];
    const y = rowY[Math.floor(i / 2)];
    p.rect(x, y, panelW, 3);
    p.rect(x, y + panelH - 3, panelW, 3);
    p.rect(x, y, 3, panelH);
    p.rect(x + panelW - 3, y, 3, panelH);
    const cx = x + panelW / 2;
    s.emblem(p, cx, y + 30);
    p.text(s.headline, 0, y + 158, 3, cx);
    p.text(s.line1, 0, y + 196, 2, cx);
    p.text(s.line2, 0, y + 220, 2, cx);
  }

  return encodePng(p.pixels);
}

// ------------------------------------------------------------- PNG
// Greyscale, 8-bit, no interlace. One filter byte (0 = none) per scanline.

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePng(pixels: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type: greyscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(HEIGHT * (WIDTH + 1));
  for (let y = 0; y < HEIGHT; y++) {
    raw[y * (WIDTH + 1)] = 0;
    Buffer.from(pixels.subarray(y * WIDTH, (y + 1) * WIDTH)).copy(raw, y * (WIDTH + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- main

const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const targetPath = join(outputDir, 'entry.png');

const png = renderFrontPage();

// The grader runs this program twice and both runs must write the same
// bytes, so prove determinism here: render a second copy and refuse to
// write anything unless it matches the first byte for byte.
const pngAgain = renderFrontPage();
if (!pngAgain.equals(png)) {
  throw new Error('render is not deterministic: two renders differ');
}

// The gate refuses anything over 1 MiB; fail loudly here instead of
// submitting an entry the gate would reject.
if (png.length > 1048576) {
  throw new Error(`entry.png is ${png.length} bytes, over the 1 MiB gate`);
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(targetPath, png);

const written = readFileSync(targetPath);
if (!written.equals(png)) {
  throw new Error(`entry.png mismatch: written bytes differ from rendered bytes`);
}

const sha256 = createHash('sha256').update(png).digest('hex');
console.log(`wrote ${targetPath} (${png.length} bytes, sha256 ${sha256})`);
