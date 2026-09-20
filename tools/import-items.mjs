// 从 Generation 9 Pack 的 Graphics/Items 里给 content/items.json 里每件道具挑图，
// 复制成 assets/items/<id>.png，并写出尺寸表 assets/data/items.json。
//
// 用法：
//   node tools/import-items.mjs                 # 用 %TEMP%\gen9items 里已解开的图
//   node tools/import-items.mjs --src <目录>     # 指定解包目录（里面应是 Items 那一层）
//   node tools/import-items.mjs --check          # 只报「缺哪些图」，不复制
//
// 解包（一次性，rar 不进仓库 —— .gitignore 里挡了 *.rar）：
//   & 'D:\Program Files\bandizip\bz.exe' x -y -o:"$env:TEMP\gen9items" `
//       "$env:USERPROFILE\Downloads\Generation 9 Pack v3.3.7.rar" 'Graphics\Items\*'
//
// 道具的 art 字段就是包里的文件名（不带 .png）。想换图就改 content/items.json 的 art，
// 再跑一次这个脚本 —— 不用手工拷文件。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'items');
const META = path.join(ROOT, 'assets', 'data', 'items.json');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const srcArg = args.includes('--src') ? args[args.indexOf('--src') + 1] : null;
const SRC = srcArg
  ? path.resolve(srcArg)
  : path.join(process.env.TEMP ?? '/tmp', 'gen9items', 'Graphics', 'Items');

const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'items.json'), 'utf8')).items;
const ids = Object.keys(items);

if (!fs.existsSync(SRC)) {
  console.error(`找不到解包目录：${SRC}\n先按文件开头注释里的 bandizip 命令解一次包。`);
  process.exit(1);
}

/** PNG 的宽高直接从文件头读（IHDR），不引任何依赖 */
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.toString('latin1', 1, 4) !== 'PNG') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const meta = {};
const missing = [];
const unusedArt = new Map();   // art -> 用了它的道具（重复用图要报出来）
for (const [id, it] of Object.entries(items)) {
  const art = it.art;
  if (!art) { missing.push(`${id}（没写 art）`); continue; }
  const src = path.join(SRC, `${art}.png`);
  if (!fs.existsSync(src)) { missing.push(`${id} → ${art}.png`); continue; }
  if (unusedArt.has(art)) {
    console.warn(`⚠ ${id} 和 ${unusedArt.get(art)} 用了同一张图（${art}）—— 两张图长得一样，玩家会分不清`);
  } else unusedArt.set(art, id);
  const size = pngSize(src);
  if (!size) { missing.push(`${id} → ${art}.png 不是合法 PNG`); continue; }
  meta[id] = { art, w: size.w, h: size.h };
  if (!checkOnly) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.copyFileSync(src, path.join(OUT_DIR, `${id}.png`));
  }
}

console.log(`道具 ${ids.length} 件 · 找到图 ${Object.keys(meta).length} 张${checkOnly ? '（--check）' : ` · 已复制到 assets/items/`}`);
const sizes = new Set(Object.values(meta).map((m) => `${m.w}x${m.h}`));
console.log(`  图尺寸：${[...sizes].join(' / ')}`);
if (missing.length) {
  console.error(`\n缺 ${missing.length} 张图：`);
  for (const m of missing) console.error('  ✗ ' + m);
  process.exit(1);
}
if (!checkOnly) {
  fs.writeFileSync(META, JSON.stringify({
    note: '道具图（Generation 9 Pack 的 Graphics/Items，按 content/items.json 的 art 字段挑选复制）。由 tools/import-items.mjs 生成。',
    items: meta,
  }, null, 2) + '\n', 'utf8');
  console.log(`written: assets/data/items.json（${Object.keys(meta).length} 条）`);
}
