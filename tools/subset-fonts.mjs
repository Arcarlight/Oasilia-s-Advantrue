// 把仓库根目录那三份字体**按游戏实际用到的字**裁成子集，写进 assets/fonts/。
//
// 为什么要裁：字体文件本身很大（SGHr 3.9MB / 文源宋体粗 14.5MB / 851Lakeus 手写 27.5MB，
// 合计 46MB），而单文件构建（tools/bundle.mjs）会把 CSS 里引用的字体**内联成 base64**
// —— 不裁的话 oasis-game.html 会从 22MB 涨到 80MB 以上，浏览器光解析就要好几秒。
// 裁成子集之后每个只剩一两百 KB，全部加起来还不到 1MB。
//
// 裁的依据是「游戏可能显示出来的每一个字」：把 content/*.json、src/**/*.js、index.html
// 里出现的所有字符都收集起来（卡名、描述、事件文案、商店招呼语、UI 文案…），
// 再补上 ASCII、常用中文标点、全角符号。凡是没被收进来的字**不会**变成方块 ——
// style.css 的字体栈里留着完整的 LXGW 兜底（见那里的说明）。
//
// 用法：
//   python -m pip install fonttools brotli      # 只需要一次
//   node tools/subset-fonts.mjs                 # 生成 assets/fonts/*-subset.woff2
//
// 内容改了（加了新卡 / 新事件）之后要重跑一次，否则新文案里可能有字落到兜底字体上。

import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'fonts');

/**
 * 源字体 → 输出名。
 * 文件放在仓库根目录（和当初那份「森泽UD新黑」一样：只用来生成，运行时读的是 assets/fonts 里的子集）。
 */
const FONTS = [
  { src: 'SGHr-Regular.ttf', out: 'SGHr-Regular-subset.woff2', label: '正文' },
  { src: 'WenYuanSerifSC-Bold.ttf', out: 'WenYuanSerifSC-Bold-subset.woff2', label: '粗体（卡名 / 商店名…）' },
  { src: '851LakeusNightWriting-Regular.ttf', out: '851LakeusNightWriting-subset.woff2', label: '手写体（轻松搞笑的地方）' },
];

/** 收集文本时要扫的范围 */
const SCAN = [
  { dir: 'content', ext: ['.json'] },
  { dir: 'src', ext: ['.js'] },
  { dir: 'tools', ext: ['.js'] },   // 诊断脚本会往页面上打中文日志，也一起收着
];
const SCAN_FILES = ['index.html'];

/** 不管内容里有没有出现，都要留下的基本字符 */
const ALWAYS = [
  ' !"#$%&\'()*+,-./0123456789:;<=>?@',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`',
  'abcdefghijklmnopqrstuvwxyz{|}~',
  // 中文标点与常用符号（文案里写没写到都得有，不然排版会突然换字体）
  '　、。〈〉《》「」『』【】〔〕・ーー—–…‘’“”′″¥￥×÷±°％‰＃＆＊＠',
  '，．；：？！（）［］｛｝＜＞＝＋－／＼｜～＄　',
  '０１２３４５６７８９',
  '←→↑↓★☆●○◆◇■□▲▼♪♭†‡§¶',
];

async function walk(dir, exts, out) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      await walk(p, exts, out);
    } else if (exts.includes(path.extname(e.name).toLowerCase())) {
      out.push(p);
    }
  }
}

const files = [];
for (const s of SCAN) await walk(path.join(ROOT, s.dir), s.ext, files);
for (const f of SCAN_FILES) files.push(path.join(ROOT, f));

const chars = new Set(ALWAYS.join(''));
for (const f of files) {
  const text = await fs.readFile(f, 'utf8');
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    // 控制字符和私用区不要（代理对在 for..of 里已经合成一个字了）
    if (cp < 0x20 || (cp >= 0xe000 && cp <= 0xf8ff)) continue;
    chars.add(ch);
  }
}

const textFile = path.join(os.tmpdir(), 'oasis-font-subset.txt');
await fs.writeFile(textFile, [...chars].join(''), 'utf8');
console.log(`收集到 ${chars.size} 个不同字符（来自 ${files.length} 个文件）-> ${textFile}`);

await fs.mkdir(OUT_DIR, { recursive: true });
let before = 0;
let after = 0;

for (const font of FONTS) {
  const src = path.join(ROOT, font.src);
  const out = path.join(OUT_DIR, font.out);
  let size = 0;
  try {
    size = (await fs.stat(src)).size;
  } catch {
    console.log(`  ✗ 找不到源字体 ${font.src}（${font.label}）—— 跳过`);
    continue;
  }
  const r = spawnSync('python', [
    '-m', 'fontTools.subset', src,
    `--text-file=${textFile}`,
    `--output-file=${out}`,
    '--flavor=woff2',
    '--layout-features=*',
    '--name-IDs=*',
    '--notdef-outline',
    '--recalc-bounds',
  ], { encoding: 'utf8' });

  if (r.status !== 0) {
    console.log(`  ✗ ${font.src} 裁剪失败：\n${(r.stderr || r.stdout || '').split('\n').slice(-6).join('\n')}`);
    process.exitCode = 1;
    continue;
  }
  const outSize = (await fs.stat(out)).size;
  before += size;
  after += outSize;
  console.log(`  ✓ ${font.label.padEnd(18)} ${font.src.padEnd(34)} ${(size / 1048576).toFixed(1)}MB -> ${font.out} ${(outSize / 1024).toFixed(0)}KB`);
}

console.log(`合计 ${(before / 1048576).toFixed(1)}MB -> ${(after / 1024).toFixed(0)}KB（省掉 ${(100 - (after / before) * 100).toFixed(1)}%）`);
