// 用 SpriteCollab 的 Offsets 图判定每一行朝向。
//
// 官方文档（PMD Sprite Format）：
//   "Frames of an animation are ordered horizontally by sequence,
//    and vertically by direction."
//   也就是 **水平 = 帧序列，竖直 = 朝向**。
// Offsets 图里：绿=身体中心，黑=头。（红/蓝是左右手）
// 通过「头相对身体中心的方向」就能判断这一行的宝可梦朝向哪边。
//
// 用法: node tools/analyze-directions.mjs [slug] [anim]
import https from 'node:https';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

// ---------- 最小 PNG 解码（只支持 8bit RGB/RGBA，非隔行） ----------
function decodePng(buf) {
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
    if (type === 'IEND') break;
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error(`不支持的 PNG 格式 bd=${bitDepth} il=${interlace}`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels || colorType === 3) throw new Error(`不支持的 colorType=${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= channels) ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (oasis asset tool)' } }, (res) => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); res.resume(); return; }
      const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => resolve(Buffer.concat(c)));
    }).on('error', reject);
  });
}

const slug = process.argv[2] ?? 'flygon';
const anim = process.argv[3] ?? 'Idle';
const meta = JSON.parse(await fs.readFile(path.join(ROOT, 'assets', 'data', 'sprites.json'), 'utf8'));
const info = meta[slug].anims[anim];
const dex = meta[slug].dex;

const url = `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/${dex}/${anim}-Offsets.png`;
const cacheDir = path.join(ROOT, 'tools', 'offsets-cache');
await fs.mkdir(cacheDir, { recursive: true });
const cacheFile = path.join(cacheDir, `${slug}-${anim}-Offsets.png`);

let buf = null;
try {
  buf = await fs.readFile(cacheFile);
} catch {
  try {
    buf = await get(url);
    await fs.writeFile(cacheFile, buf);
    console.log(`（已下载 Offsets 图：${url}）`);
  } catch (err) {
    console.log(`拿不到 Offsets 图（${err.message}），没法做朝向分析`);
    process.exit(1);
  }
}

const png = decodePng(buf);
console.log(`${slug}/${anim}: offsets 图 ${png.width}x${png.height}，帧 ${info.fw}x${info.fh}，${info.cols} 列 x ${info.rows} 行`);
if (png.width !== info.cols * info.fw || png.height !== info.rows * info.fh) {
  console.log('⚠ Offsets 图尺寸和精灵图不一致，行序可能对不上');
}

/** 找出某个帧里绿点（身体中心）与黑点（头）的位置 */
function probe(cx0, cy0) {
  let green = null, black = null;
  for (let y = 0; y < info.fh; y++) {
    for (let x = 0; x < info.fw; x++) {
      const i = ((cy0 + y) * png.width + (cx0 + x)) * png.channels;
      const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      const a = png.channels === 4 ? png.data[i + 3] : 255;
      if (a < 128) continue;
      // 绿：(0,255,0) 附近；黑：(0,0,0)
      if (!green && g > 180 && r < 90 && b < 90) green = { x, y };
      if (!black && r < 40 && g < 40 && b < 40) black = { x, y };
    }
  }
  return { green, black };
}

const results = [];
for (let r = 0; r < info.rows; r++) {
  // 用第一帧做朝向判定（每一行朝向一致）
  const { green, black } = probe(0, r * info.fh);
  let label = '?';
  if (green && black) {
    const dx = black.x - green.x;
    const dy = black.y - green.y;
    // 头在身体中心上方 => 面朝观者/下方；头在下方 => 背对；左右 => 侧向
    const side = Math.abs(dx) > Math.abs(dy) * 1.3;
    if (side) label = dx < 0 ? '← 朝左（侧面）' : '→ 朝右（侧面）';
    else if (dy > 0) label = '↓ 朝下（正面/面朝观者）';
    else label = '↑ 朝上（背面）';
    results.push({ row: r, label, dx, dy, head: black, body: green });
  } else {
    results.push({ row: r, label: `无法判定（绿点${green ? '有' : '无'} / 黑点${black ? '有' : '无'}）`, dx: null, dy: null });
  }
}

console.log('\n行号 -> 朝向：');
for (const r of results) {
  const d = r.dx === null ? '' : `  头相对身体 dx=${String(r.dx).padStart(4)} dy=${String(r.dy).padStart(4)}`;
  console.log(`  row ${r.row}  ${r.label}${d}`);
}

const front = results.find((r) => r.label.includes('朝下'));
const back = results.find((r) => r.label.includes('朝上'));
const left = results.find((r) => r.label.includes('朝左'));
const right = results.find((r) => r.label.includes('朝右'));
console.log('\n结论：' + JSON.stringify({
  正面: front?.row ?? null,
  背面: back?.row ?? null,
  朝左: left?.row ?? null,
  朝右: right?.row ?? null,
}));
