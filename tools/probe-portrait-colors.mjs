// 一次性排查：把每种表情头像的**背景色**打出来。
//
// 起因：用户问「角色受伤的时候为什么用激动的表情（那个黄底的）」。
// 表情名字（Pain / Inspired / Shouting…）光看名字猜不出是哪张，
// 但每张 PMD 头像都带一块**纯色底**，把底色调出来就能一一对上。
//
// 用法：node tools/probe-portrait-colors.mjs [物种slug]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2] ?? 'flygon';
const dir = path.join(ROOT, 'assets', 'portraits', slug);

function decodePNG(file) {
  const buf = fs.readFileSync(file);
  let off = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let color = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      color = data[9];
    } else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8) return null;
  const channels = color === 6 ? 4 : color === 2 ? 3 : null;
  if (!channels) return null;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const pa = Math.abs(b - c); const pb = Math.abs(a - c); const pc = Math.abs(a + b - 2 * c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
      cur[x] = v;
    }
    prev = cur;
  }
  return { w, h, channels, px: out };
}

/** 四个角里出现最多的那个颜色 —— 头像的背景 */
function cornerColor(img) {
  const { w, h, channels, px } = img;
  const pts = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [1, 1], [w - 2, h - 2]];
  const tally = new Map();
  for (const [x, y] of pts) {
    const i = (y * w + x) * channels;
    const key = `${px[i]},${px[i + 1]},${px[i + 2]}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return [...tally].sort((a, b) => b[1] - a[1])[0][0];
}
const isYellowish = (rgb) => {
  const [r, g, b] = rgb.split(',').map(Number);
  return r > 150 && g > 130 && b < 140 && r + g - 2 * b > 90;
};

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
console.log(`\n${slug} 的 ${files.length} 种表情（按背景色判断是不是「黄底的」）：\n`);
const yellows = [];
for (const f of files) {
  const img = decodePNG(path.join(dir, f));
  if (!img) { console.log(`  ${f.padEnd(18)} ✗ 解不开`); continue; }
  const c = cornerColor(img);
  const y = isYellowish(c);
  if (y) yellows.push(f.replace('.png', ''));
  console.log(`  ${f.replace('.png', '').padEnd(18)} 底色 rgb(${c})  ${y ? '← 黄底' : ''}`);
}
console.log(`\n黄底的表情：${yellows.join('、') || '（没有）'}`);
