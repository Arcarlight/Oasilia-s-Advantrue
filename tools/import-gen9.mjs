// 从 Generation 9 Pack 里把本作用得到的 84 只宝可梦的**正面 / 背面立绘**挑出来，
// 复制成 assets/gen9/<slug>/front.png 与 back.png，并写一份 assets/data/gen9.json。
//
// 为什么单独建一个目录而不是混进 assets/pokemon：
//   assets/pokemon 是 SpriteCollab 的 PMD 行走图（每张是一整张帧表，靠 canvas 裁切播放），
//   而这里是 Essentials 风格的**单张立绘**（一张图 = 一个姿势），两者用途完全不同：
//   行走图负责「场上的战斗姿态」，立绘负责「回合切换时的特写」。
//
// 用法：node tools/import-gen9.mjs [解包目录]
//   解包目录默认取 %TEMP%\gen9x（内含 Graphics\Pokemon\{Front,Back}），
//   这一步由 README 里记的那条 Bandizip 命令产出，仓库里不放原始 rar 解包结果。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_ROOT = process.argv[2] ?? path.join(os.tmpdir(), 'gen9x', 'Graphics', 'Pokemon');
const SPECIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'species.json'), 'utf8')).species;
const OUT_DIR = path.join(ROOT, 'assets', 'gen9');
const JS_OUT = path.join(ROOT, 'src', 'data', 'gen9.js');

/** 从 PNG 的 IHDR 直接读宽高（不用解码整张图，够用且没有依赖） */
function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(24);
    fs.readSync(fd, head, 0, 24, 0);
    if (head.readUInt32BE(0) !== 0x89504e47) return null; // PNG magic
    return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * 解出 RGBA 像素，并算出**可见内容的包围盒**（bbox）。
 *
 * 为什么要 bbox：这些图的画布是固定尺寸（正面 192²、背面 288²），
 * 但是「图案占画布多少」每只都不一样 —— 卡比兽顶满整张，刺尾虫只有中间一小团。
 * 界面要按 bbox 归一化才能让每一只都填满同一个框（不然小的那只看起来像没画出来）。
 * 这一步只在导入时做一次，结果写进 gen9.json，运行时不用再解码。
 *
 * 只处理 8bit / color type 6（RGBA）/ 非隔行 —— 这个 pack 里 168 张全是这一种。
 */
function pngRGBA(file) {
  const buf = fs.readFileSync(file);
  let off = 8;
  let w = 0;
  let h = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      const depth = data[8];
      const color = data[9];
      const interlace = data[12];
      if (depth !== 8 || color !== 6 || interlace !== 0) {
        throw new Error(`${path.basename(file)} 不是 8bit RGBA 非隔行 PNG（depth=${depth} color=${color} interlace=${interlace}）`);
      }
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = w * bpp;
  const out = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v = (v + a) & 0xff; break;
        case 2: v = (v + b) & 0xff; break;
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          const pr = pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
          v = (v + pr) & 0xff;
          break;
        }
        default: throw new Error(`未知的 PNG 滤波类型 ${filter}`);
      }
      cur[x] = v;
    }
    prev = cur;
  }

  // bbox：只认 alpha > 8 的像素（和 sprites.js 里判空帧的阈值保持一致）
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (out[y * stride + x * bpp + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { w, h, box: null, px: out };
  return { w, h, box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }, px: out };
}

/** 最小 PNG 编码器（8bit RGBA、非隔行）。用来把立绘裁到包围盒之后再存盘。 */
function encodePNG(px, w, h) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // 滤波 0（None）：小图不值得为此多写一段自适应逻辑
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 从整张画布里抠出包围盒（外加 margin 圈透明边，避免图案顶到边框） */
function cropPixels(img, margin = 2) {
  const { box, px, w, h } = img;
  if (!box) return null;
  const x0 = Math.max(0, box.x - margin);
  const y0 = Math.max(0, box.y - margin);
  const x1 = Math.min(w - 1, box.x + box.w - 1 + margin);
  const y1 = Math.min(h - 1, box.y + box.h - 1 + margin);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    px.copy(out, y * cw * 4, ((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + cw) * 4);
  }
  return { px: out, w: cw, h: ch };
}

function pick(dir, en) {
  const exact = path.join(dir, `${en}.png`);
  if (fs.existsSync(exact)) return exact;
  // 兜底：大小写不敏感（不同版本的 pack 大小写规则不完全一致）
  const want = `${en}.png`.toLowerCase();
  const hit = fs.readdirSync(dir).find((f) => f.toLowerCase() === want);
  return hit ? path.join(dir, hit) : null;
}

function main() {
  const fronts = path.join(SRC_ROOT, 'Front');
  const backs = path.join(SRC_ROOT, 'Back');
  if (!fs.existsSync(fronts) || !fs.existsSync(backs)) {
    console.error(`找不到解包目录：${SRC_ROOT}\n先按 README「回合切换立绘」一节解包 Generation 9 Pack。`);
    process.exit(1);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  const meta = {};
  const missing = [];
  let bytes = 0;

  for (const [slug, def] of Object.entries(SPECIES)) {
    const en = String(def.en ?? '').toUpperCase();
    const f = pick(fronts, en);
    const b = pick(backs, en);
    if (!f || !b) {
      missing.push(`${slug}(${en})${f ? '' : ' 缺正面'}${b ? '' : ' 缺背面'}`);
      continue;
    }
    const dir = path.join(OUT_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    const parts = {};
    for (const [kind, file] of [['front', f], ['back', b]]) {
      const img = pngRGBA(file);
      const crop = cropPixels(img);
      if (!crop) {
        missing.push(`${slug}(${en}) ${kind} 里没有可见像素`);
        break;
      }
      const png = encodePNG(crop.px, crop.w, crop.h);
      fs.writeFileSync(path.join(dir, `${kind}.png`), png);
      bytes += png.length;
      // 存「裁切后的宽高」和「原画布 + 包围盒」：前者界面用来算显示尺寸，
      // 后者留着给诊断脚本核对（例如确认裁切没有把边角吃掉）。
      parts[kind] = { w: crop.w, h: crop.h, canvas: { w: img.w, h: img.h }, box: img.box };
    }
    if (!parts.front || !parts.back) continue;
    meta[slug] = parts;
  }

  const js = [
    '// 本文件由 tools/import-gen9.mjs 生成，请勿手改。',
    '//',
    '// 每只宝可梦的回合切换立绘：front = 正面（敌方用），back = 背面（我方用，和正作一样看自己人的后背）。',
    '// front.png / back.png 已经**按可见内容裁到包围盒**，所以界面只要按 w/h 的宽高比缩放到目标框里就行，',
    '// 不需要再算偏移；canvas/box 是裁切前的原始画布与包围盒，留给诊断脚本核对。',
    '',
    '/** @type {Record<string, {front: Gen9Sprite, back: Gen9Sprite}>} */',
    'export const GEN9_ART = {',
  ];
  for (const [slug, m] of Object.entries(meta)) {
    js.push(`  ${slug}: {`);
    for (const kind of ['front', 'back']) {
      const i = m[kind];
      js.push(
        `    ${kind}: { w: ${i.w}, h: ${i.h}, `
        + `canvas: { w: ${i.canvas.w}, h: ${i.canvas.h} }, `
        + `box: { x: ${i.box.x}, y: ${i.box.y}, w: ${i.box.w}, h: ${i.box.h} } },`,
      );
    }
    js.push('  },');
  }
  js.push('};', '');
  fs.mkdirSync(path.dirname(JS_OUT), { recursive: true });
  fs.writeFileSync(JS_OUT, js.join('\n'));

  console.log(`导出 ${Object.keys(meta).length} 只，共 ${(bytes / 1024 / 1024).toFixed(2)} MB -> assets/gen9/`);
  console.log(`元数据 -> ${path.relative(ROOT, JS_OUT)}`);
  const ratios = [];
  let widest = { slug: '', ar: 0 };
  let tallest = { slug: '', ar: 99 };
  for (const [slug, m] of Object.entries(meta)) {
    for (const kind of ['front', 'back']) {
      const ar = m[kind].w / m[kind].h;
      ratios.push(ar);
      if (ar > widest.ar) widest = { slug: `${slug}/${kind}`, ar };
      if (ar < tallest.ar) tallest = { slug: `${slug}/${kind}`, ar };
    }
  }
  ratios.sort((a, b) => a - b);
  console.log(
    `裁切后宽高比 最窄 ${tallest.slug} ${tallest.ar.toFixed(2)} / `
    + `中位 ${ratios[Math.round(ratios.length / 2)].toFixed(2)} / `
    + `最宽 ${widest.slug} ${widest.ar.toFixed(2)}`,
  );
  if (missing.length) {
    console.error(`缺少 ${missing.length} 只：\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
}

main();
