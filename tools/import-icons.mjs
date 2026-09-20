// 从 Generation 9 Pack 里导出**小图标**（Essentials 的 animated Icons）。
//
// 格式：每张 `Graphics/Pokemon/Icons/<英文名大写>.png` 是 **64×64 一帧、横向排开**的动图条
// （实测主线那 1482 张全是 128×64 = 2 帧；个别有 4 帧的也照原样搬，帧数运行时按宽度算）。
// 导出成 `assets/icons/<slug>.png`，并写一份 `assets/data/icons.json`（每只的帧数 / 帧宽）。
//
//   node tools/import-icons.mjs [解包目录]     # 默认 %TEMP%\gen9x
//
// 解包（README「回合切换立绘」那一节同一条路）：
//   & "D:\Program Files\bandizip\bz.exe" x -y -o:"$env:TEMP\gen9x" "Generation 9 Pack v3.3.7.rar" "Graphics\Pokemon\Icons\*"
//
// 找不到小图标的物种会在最后列出来（运行时会退回 PMD 头像，不会开天窗）。
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(process.argv[2] ?? path.join(os.tmpdir(), 'gen9x'), 'Graphics', 'Pokemon', 'Icons');
const OUT = path.join(ROOT, 'assets', 'icons');
const DATA = path.join(ROOT, 'assets', 'data');

/** PNG 的 IHDR 直接读宽高（不解码整张图） */
function pngSize(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IHDR') return { w: buf.readUInt32BE(off + 8), h: buf.readUInt32BE(off + 12) };
    off += 12 + len;
  }
  return null;
}

const species = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'species.json'), 'utf8')).species;
const files = new Set(await fs.readdir(SRC).catch(() => []));
if (!files.size) {
  console.error(`找不到图标目录：${SRC}\n先按注释里的命令解包 Generation 9 Pack 的 Graphics\\Pokemon\\Icons。`);
  process.exit(1);
}
/** 英文名 → 包里的文件名：大写、去掉非字母数字（Farfetch'd → FARFETCHD） */
const nameOf = (en) => String(en ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const pick = (base) => {
  for (const cand of [base, `${base}_1`, `${base}_0`]) if (files.has(`${cand}.png`)) return `${cand}.png`;
  return null;
};

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });
const meta = {};
const missing = [];
let bytes = 0;
for (const [slug, def] of Object.entries(species)) {
  const file = pick(nameOf(def.en));
  if (!file) { missing.push(`${slug}(${def.en})`); continue; }
  const buf = await fs.readFile(path.join(SRC, file));
  const size = pngSize(buf);
  if (!size || size.h !== 64) { missing.push(`${slug}(${def.en}) 尺寸异常 ${size?.w}×${size?.h}`); continue; }
  const frames = Math.round(size.w / 64);
  if (frames < 1 || frames * 64 !== size.w) { missing.push(`${slug}(${def.en}) 帧宽不是 64 的整数倍：${size.w}`); continue; }
  await fs.writeFile(path.join(OUT, `${slug}.png`), buf);
  meta[slug] = { frames, fw: 64, fh: 64 };
  bytes += buf.length;
}

await fs.writeFile(path.join(DATA, 'icons.json'), `${JSON.stringify(meta, null, 1)}\n`, 'utf8');
/**
 * 同时生成 `src/data/icons.js`（和 tools/import-gen9.mjs 生成的 src/data/gen9.js 一样）：
 * 运行时读这份**帧数表**来判断「一只小图标有几帧」（帧宽固定 64）——
 * 开发时读 `assets/icons/<slug>.png`，单文件包里换成内联的 data URI。
 */
const js = [
  '// 本文件由 tools/import-icons.mjs 生成，请勿手改。',
  '//',
  '// 小图标（Essentials 的 animated Icons，来自 Generation 9 Pack）：每张是「64×64 一帧、横向排开」的动图条，',
  '// 这里只记帧数；帧宽固定 64。图片本体的地址在 src/core/icons.js 里解析',
  '// （开发时是 assets/icons/<slug>.png，单文件包里是 window.__OASIS_ICONS__ 的 data URI）。',
  '',
  'export const ICON_META = {',
  ...Object.entries(meta).map(([slug, m]) => `  ${slug}: ${JSON.stringify(m)},`),
  '};',
  '',
].join('\n');
await fs.writeFile(path.join(ROOT, 'src', 'data', 'icons.js'), js, 'utf8');

console.log(`导出 ${Object.keys(meta).length} 只的小图标，共 ${(bytes / 1024).toFixed(0)} KB -> assets/icons/`);
const hist = {};
for (const m of Object.values(meta)) hist[m.frames] = (hist[m.frames] ?? 0) + 1;
console.log('帧数分布：' + Object.entries(hist).map(([k, v]) => `${k} 帧 × ${v}`).join('　'));
if (missing.length) {
  console.log(`\n包没有这 ${missing.length} 只的小图标（运行时会退回 PMD 头像）：`);
  console.log('  ' + missing.join('、'));
}
