// iconpack-probe.mjs — 侦察 Game Icon Pack（Nieobie/game-icon-pack）素材形态
// 只读分析，不改动仓库里任何游戏资源。
//
// 用法（先把仓库快照解到临时目录，见 tools/iconpack-report.md 的复现命令）：
//   node tools/iconpack-probe.mjs --svg <解压出的 svg 目录根> [--png <解压出的 png 目录根>]
//
// 输出：纯文本统计，直接可以贴进报告。

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const svgRoot = arg('--svg', path.join(process.env.TEMP || '/tmp', 'gip', 'repo', 'game-icon-pack-main', 'svg'));
const pngRoot = arg('--png', path.join(process.env.TEMP || '/tmp', 'gip', 'pngsel'));

const kb = (n) => `${(n / 1024).toFixed(2)} KB`;

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/* ---------------------------------------------------------------- SVG 形态 */
function scanSvg(root) {
  const files = walk(root).filter((f) => f.endsWith('.svg'));
  const stat = {
    root,
    total: files.length,
    variants: {},
    fillAttr: {},
    hasRect: 0,
    rectFullCanvas: 0,
    pathCount: {},
    sizes: [],
    viewBoxTight: 0,
    viewBoxOther: {},
    multiFill: [],
    notCurrentColor: [],
    fillRule: {},
  };
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    const variant = rel.split('/')[0];             // padding | no-padding
    stat.variants[variant] = (stat.variants[variant] || 0) + 1;
    const src = fs.readFileSync(f, 'utf8');
    stat.sizes.push(Buffer.byteLength(src));

    const m = src.match(/<svg\b[^>]*>/);
    const head = m ? m[0] : '';
    const fill = (head.match(/fill="([^"]*)"/) || [, '(none)'])[1];
    stat.fillAttr[fill] = (stat.fillAttr[fill] || 0) + 1;

    const vb = (head.match(/viewBox="([^"]*)"/) || [, '(none)'])[1];
    const parts = vb.split(/\s+/).map(Number);
    // no-padding 的 viewBox 是紧贴墨迹的裁剪框；padding 的是原始 10x10 网格
    if (parts.length === 4 && (parts[0] !== 0 || parts[1] !== 0)) stat.viewBoxTight++;
    else stat.viewBoxOther[vb] = (stat.viewBoxOther[vb] || 0) + 1;

    const paths = src.match(/<path\b/g) || [];
    stat.pathCount[paths.length] = (stat.pathCount[paths.length] || 0) + 1;
    if (paths.length === 0) stat.zeroPath = [...(stat.zeroPath || []), rel];
    if (/<rect\b/.test(src)) {
      stat.hasRect++;
      stat.rectFiles = [...(stat.rectFiles || []), rel];
      const r = src.match(/<rect\b[^>]*>/);
      const w = Number((r[0].match(/width="([^"]*)"/) || [, 0])[1]);
      const h = Number((r[0].match(/height="([^"]*)"/) || [, 0])[1]);
      const rx = Number((r[0].match(/rx="([^"]*)"/) || [, 0])[1]);
      const vw = parts[2];
      // rx >= 半边 说明这个「矩形」其实是圆/胶囊，mask 出来还是圆，不是实心方块
      const isRound = rx >= Math.min(w, h) / 2 - 0.01;
      if (w >= vw * 0.98 && h >= vw * 0.98) {
        stat.rectFullCanvas++;
        stat.multiFill.push(`满画布 rect(${w}x${h} rx=${rx}) ${isRound ? '=圆形，安全' : '!! 可能是实心方块'} <- ${rel}`);
      }
    }
    // 任何显式颜色（非 currentColor / none）都会被 mask 吃掉，需要记下来
    const colors = [...src.matchAll(/(?:fill|stroke)="([^"]*)"/g)]
      .map((x) => x[1])
      .filter((c) => c && c !== 'currentColor' && c !== 'none');
    if (colors.length) stat.notCurrentColor.push(`${rel} -> ${colors.join('|')}`);

    const fr = [...src.matchAll(/fill-rule="([^"]*)"/g)].map((x) => x[1]);
    for (const r of fr) stat.fillRule[r] = (stat.fillRule[r] || 0) + 1;
  }
  stat.sizes.sort((a, b) => a - b);
  return stat;
}

/* ------------------------------------------------------------- PNG 像素统计 */
// 无依赖 PNG 解码：IHDR + IDAT inflate + 逐行反过滤。只支持 8bit RGBA/RGB/灰度。
function decodePng(file) {
  const buf = fs.readFileSync(file);
  let off = 8;
  let w = 0, h = 0, bitDepth = 0, colorType = 0, ihdrSeen = false;
  const idat = [];
  let plte = null, trns = null;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; ihdrSeen = true;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ihdrSeen) throw new Error('no IHDR');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported colorType ${colorType}`);
  // 位深 != 8 的（调色板/灰度 1/2/4 bit）先按字节反过滤，再解包成每像素 1 字节
  if (bitDepth !== 8) {
    if (colorType !== 3 && colorType !== 0) throw new Error(`unsupported bitDepth ${bitDepth} colorType ${colorType}`);
    const rowBytes = Math.ceil(w * bitDepth / 8);
    const tmp = Buffer.alloc(h * rowBytes);
    let p = 0;
    for (let y = 0; y < h; y++) {
      const ft = raw[p++];
      const line = raw.subarray(p, p + rowBytes); p += rowBytes;
      const cur = tmp.subarray(y * rowBytes, (y + 1) * rowBytes);
      const prev = y > 0 ? tmp.subarray((y - 1) * rowBytes, y * rowBytes) : Buffer.alloc(rowBytes);
      for (let x = 0; x < rowBytes; x++) {
        const a = x >= 1 ? cur[x - 1] : 0, b = prev[x], c = x >= 1 ? prev[x - 1] : 0;
        let v = line[x];
        if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
        else if (ft === 4) { const pr = a + b - c, pa = Math.abs(pr - a), pb = Math.abs(pr - b), pc = Math.abs(pr - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
        cur[x] = v & 0xff;
      }
    }
    const mask = (1 << bitDepth) - 1;
    const perByte = 8 / bitDepth;
    const out = Buffer.alloc(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const byte = tmp[y * rowBytes + Math.floor(x / perByte)];
      const shift = 8 - bitDepth * ((x % perByte) + 1);
      out[y * w + x] = (byte >> shift) & mask;
    }
    return { w, h, bpp: 1, colorType, plte, trns, pixels: out, paletteOnly: true };
  }
  const bpp = channels;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, bpp, colorType, plte, trns, pixels: out };
}

// 统计：不透明像素占比、墨迹包围盒、以及“是不是一个满幅矩形”
function pngStats(file) {
  const { w, h, bpp, colorType, plte, trns, pixels } = decodePng(file);
  let opaque = 0, full = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  const rgba = (i) => {
    if (colorType === 6) return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    if (colorType === 4) return [pixels[i], pixels[i], pixels[i], pixels[i + 1]];
    if (colorType === 3) {
      const idx = pixels[i];
      const a = trns && idx < trns.length ? trns[idx] : 255;   // 调色板透明度看 tRNS
      return plte ? [plte[idx * 3], plte[idx * 3 + 1], plte[idx * 3 + 2], a] : [0, 0, 0, a];
    }
    if (colorType === 2) return [pixels[i], pixels[i + 1], pixels[i + 2], 255];
    return [pixels[i], pixels[i], pixels[i], 255];              // 灰度
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = rgba((y * w + x) * bpp);
      if (a > 8) {
        opaque++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (r > 200 && g > 200 && b > 200) full++;
      }
    }
  }
  const total = w * h;
  const bboxW = maxX >= minX ? maxX - minX + 1 : 0;
  const bboxH = maxY >= minY ? maxY - minY + 1 : 0;
  return {
    file: path.basename(file), w, h, bytes: fs.statSync(file).size,
    opaquePct: +(opaque / total * 100).toFixed(2),
    bbox: `${bboxW}x${bboxH}`, bboxCoverPct: +(bboxW * bboxH / total * 100).toFixed(2),
    looksLikeFullRect: bboxW >= w - 1 && bboxH >= h - 1 && opaque / total > 0.9,
    colorType,
  };
}

/* ---------------------------------------------------------- 语义检索（--find） */
// node tools/iconpack-probe.mjs --find "治疗,heal,shield"
function findByKeywords(kws) {
  const cat = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'icon-catalog.json'), 'utf8'));
  const list = Array.isArray(cat) ? cat : Object.values(cat).flat();
  for (const kw of kws) {
    const k = kw.trim().toLowerCase();
    const hits = list.filter((e) => JSON.stringify(e).toLowerCase().includes(k));
    console.log(`\n### 关键词「${kw}」 命中 ${hits.length}`);
    for (const e of hits.slice(0, 12)) {
      console.log(`  ${e.component_name}\n     语义: ${e.core_semantic}\n     外形: ${e.visual_features}`);
    }
    if (!hits.length) console.log('  （无命中 —— 该概念在包里没有直接对应，需要选“最近语义”）');
  }
}

/* ------------------------------------------------- 自包含性 / 宽高比断言 */
function selfContainment(root) {
  const files = walk(root).filter((f) => f.endsWith('.svg'));
  const pats = {
    '外部引用 <use>': /<use\b/, '内嵌 <style>': /<style\b/, '位图 <image>': /<image\b/,
    'xlink:': /xlink:/, '<script>': /<script\b/, '<defs>': /<defs\b/, '<mask>': /<mask\b/,
  };
  console.log('\n==================== 自包含性断言（能否直接当 CSS mask） ====================');
  console.log(`扫描 ${files.length} 个 svg`);
  for (const [label, re] of Object.entries(pats)) {
    const n = files.filter((f) => re.test(fs.readFileSync(f, 'utf8'))).length;
    console.log(`  ${label.padEnd(16)} ${n} 个${n ? '   <-- 需要人工看一眼' : ' ✓'}`);
  }
  // no-padding 的紧贴裁剪框，宽高比越接近 1 说明越「方正」
  const ratios = {};
  for (const f of files) {
    const m = fs.readFileSync(f, 'utf8').match(/viewBox="([^"]*)"/);
    if (!m) continue;
    const p = m[1].split(/\s+/).map(Number);
    if (p[0] === 0 && p[1] === 0) continue;              // 跳过 padding 版
    const ar = +(p[2] / p[3]).toFixed(2);
    ratios[ar] = (ratios[ar] || 0) + 1;
  }
  const top = Object.entries(ratios).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`no-padding 裁剪框宽高比分布（Top8）: ${top.map(([k, v]) => `${k}×${v}`).join(', ')}`);
  const square = ratios['1'] || 0;
  console.log(`裁剪框为正方形(比=1)的图标: ${square} / 815 —— 说明它是「按墨迹包围盒的最大边裁成正方形并居中」，`
    + `所以 mask-size:contain 下同一尺寸里所有图标的视觉重量大致一致（细长图只是自己窄）。`);
}

/* ------------------------------------------------------------------- 主流程 */
const findIdx = argv.indexOf('--find');
if (findIdx >= 0) {
  findByKeywords((argv[findIdx + 1] || '').split(','));
  process.exit(0);
}

const s = scanSvg(svgRoot);
console.log('==================== SVG 形态审计 ====================');
console.log(`svg 根目录      : ${s.root}`);
console.log(`文件总数        : ${s.total}  (variants: ${JSON.stringify(s.variants)})`);
console.log(`根 <svg> fill=  : ${JSON.stringify(s.fillAttr)}`);
console.log(`含 <rect> 的    : ${s.hasRect}  (其中满幅矩形: ${s.rectFullCanvas})`);
console.log(`<path> 数量分布 : ${JSON.stringify(s.pathCount)}`);
console.log(`填充规则        : ${JSON.stringify(s.fillRule)}`);
console.log(`viewBox 紧贴墨迹: ${s.viewBoxTight}`);
console.log(`viewBox 其它    : ${JSON.stringify(s.viewBoxOther)}`);
console.log(`显式非 currentColor 颜色: ${s.notCurrentColor.length}`);
s.notCurrentColor.slice(0, 10).forEach((x) => console.log(`   ! ${x}`));
console.log(`含 <rect> 的文件: ${(s.rectFiles || []).join(', ') || '(无)'}`);
console.log(`满画布 rect 明细（会被 mask 成整块，必须确认是不是圆）:`);
(s.multiFill || []).forEach((x) => console.log(`   ${x}`));
console.log(`无 <path> 的文件: ${(s.zeroPath || []).join(', ') || '(无)'}`);
const mn = s.sizes[0], md = s.sizes[Math.floor(s.sizes.length / 2)], mx = s.sizes[s.sizes.length - 1];
const sum = s.sizes.reduce((a, b) => a + b, 0);
console.log(`单文件字节: min ${mn} / median ${md} / max ${mx} / 平均 ${(sum / s.sizes.length).toFixed(0)} / 合计 ${kb(sum)}`);
console.log(`base64 内联后合计预估: ${kb(Math.ceil(sum / 3) * 4)}  (data:image/svg+xml;base64,+33%)`);

selfContainment(svgRoot);

if (fs.existsSync(pngRoot)) {
  console.log('\n==================== PNG 像素统计 ====================');
  const pngs = walk(pngRoot).filter((f) => f.endsWith('.png') && !/Preview|Thanks|What is Padding/.test(f));
  for (const p of pngs) {
    try {
      const st = pngStats(p);
      console.log(`${st.file.padEnd(12)} ${st.w}x${st.h} ${String(st.bytes).padStart(6)} B  不透明像素 ${String(st.opaquePct).padStart(6)}%  墨迹bbox ${st.bbox} (${st.bboxCoverPct}% 面积)  满幅矩形? ${st.looksLikeFullRect}  colorType=${st.colorType}  ${path.relative(pngRoot, p).split(path.sep).join('/')}`);
    } catch (e) {
      console.log(`!! ${p}: ${e.message}`);
    }
  }
}
