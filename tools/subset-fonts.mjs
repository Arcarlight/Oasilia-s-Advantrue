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
  { src: 'YShiWrittenSC-Regular.ttf', out: 'YShiWrittenSC-subset.woff2', label: '手写体（写意体 SC）' },
];

/**
 * 补丁字体：新手写体（写意体 SC，码位 7977）**缺几个字**，用它上一任补上。
 *
 * 实测缺的是：～ ⓪ ✓ ↔ ≈ － 以及 23 个日文汉字（BGM 曲名里的「音楽の卵」这类）。
 * 缺的字会掉到 LXGW 兜底 —— 那是套黑体，夹在手写句子里非常扎眼（用户看到的
 * 「这个字体严重缺字」其实就是这个现象，只不过真正的原因是子集过期，见下面说明）。
 * 所以把旧手写体按**只含这几个字**再裁一次，只有几 KB，逐字补洞。
 */
const PATCH = {
  src: '851LakeusNightWriting-Regular.ttf',
  out: '851LakeusNightWriting-patch.woff2',
  /** 拿它当基准：它缺的字就是要补的字 */
  base: 'YShiWrittenSC-Regular.ttf',
  label: '手写体补丁（补写意体缺的字）',
};

/** 每份子集覆盖了哪些字 / 缺哪些字，写进这个清单；check-content.mjs 按它守住「别过期」 */
const MANIFEST = path.join(OUT_DIR, 'subset-manifest.json');

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
const text = [...chars].join('');
await fs.writeFile(textFile, text, 'utf8');
console.log(`收集到 ${chars.size} 个不同字符（来自 ${files.length} 个文件）-> ${textFile}`);

await fs.mkdir(OUT_DIR, { recursive: true });

/** 跑一次 pyftsubset */
function subset(srcFile, outFile, textFilePath) {
  return spawnSync('python', [
    '-m', 'fontTools.subset', srcFile,
    `--text-file=${textFilePath}`,
    `--output-file=${outFile}`,
    '--flavor=woff2',
    '--layout-features=*',
    '--name-IDs=*',
    '--notdef-outline',
    '--recalc-bounds',
  ], { encoding: 'utf8' });
}

/**
 * 问 fontTools：这些字体各自缺哪些字（按上面那份字符全集算）。
 * 返回 { 文件名: { missing: '缺的字', codepoints: n } }
 */
function coverage(fontFiles) {
  const py = `
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from fontTools.ttLib import TTFont
text = open(sys.argv[1], encoding='utf-8').read()
out = {}
for p in sys.argv[2:]:
    f = TTFont(p, fontNumber=0, lazy=True)
    cmap = set()
    for t in f['cmap'].tables:
        cmap |= set(t.cmap.keys())
    out[p.replace(chr(92), '/').split('/')[-1]] = {
        'missing': ''.join(sorted({c for c in text if ord(c) not in cmap})),
        'codepoints': len(cmap),
    }
print(json.dumps(out, ensure_ascii=False))
`;
  const scriptFile = path.join(os.tmpdir(), 'oasis-subset-coverage.py');
  // 脚本本身每次写一遍：内容和这里保持一步之遥，省得两份文件不一致
  return fs.writeFile(scriptFile, py, 'utf8').then(() => {
    const r = spawnSync('python', [scriptFile, textFile, ...fontFiles], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`覆盖检查失败：${(r.stderr || '').split('\n').slice(-4).join(' ')}`);
    return JSON.parse(r.stdout);
  });
}

let before = 0;
let after = 0;
const produced = [];

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
  const r = subset(src, out, textFile);

  if (r.status !== 0) {
    console.log(`  ✗ ${font.src} 裁剪失败：\n${(r.stderr || r.stdout || '').split('\n').slice(-6).join('\n')}`);
    process.exitCode = 1;
    continue;
  }
  const outSize = (await fs.stat(out)).size;
  before += size;
  after += outSize;
  produced.push({ ...font, srcBytes: size, outBytes: outSize });
  console.log(`  ✓ ${font.label.padEnd(18)} ${font.src.padEnd(34)} ${(size / 1048576).toFixed(1)}MB -> ${font.out} ${(outSize / 1024).toFixed(0)}KB`);
}

// ---- 补丁子集：把「新字体缺、旧字体有」的那几个字单独裁出来 ----
const mainOuts = produced.map((f) => path.join(OUT_DIR, f.out));
let patchInfo = null;
if (mainOuts.length) {
  const cov = await coverage(mainOuts);
  const baseOut = produced.find((f) => f.src === PATCH.base);
  const baseMissing = baseOut ? (cov[baseOut.out]?.missing ?? '') : '';
  const patchSrc = path.join(ROOT, PATCH.src);
  const patchOut = path.join(OUT_DIR, PATCH.out);
  if (baseMissing && (await fs.stat(patchSrc).catch(() => null))) {
    const patchTextFile = path.join(os.tmpdir(), 'oasis-font-patch.txt');
    await fs.writeFile(patchTextFile, baseMissing, 'utf8');
    const r = subset(patchSrc, patchOut, patchTextFile);
    if (r.status !== 0) {
      console.log(`  ✗ 补丁子集裁剪失败：\n${(r.stderr || r.stdout || '').split('\n').slice(-6).join('\n')}`);
      process.exitCode = 1;
    } else {
      const size = (await fs.stat(patchSrc)).size;
      const outSize = (await fs.stat(patchOut)).size;
      before += size;
      after += outSize;
      const patchCov = await coverage([patchOut]);
      // 注意：要拿「想要补的那几个字」去比对，不是拿整个字符全集 ——
      // 补丁文件本来就只有那几十个字，按全集比会列出两千个「缺字」，纯噪声。
      const patchMissing = new Set(patchCov[PATCH.out]?.missing ?? '');
      const stillMissing = [...baseMissing].filter((c) => patchMissing.has(c)).join('');
      patchInfo = {
        base: PATCH.base, wants: baseMissing.length, out: PATCH.out,
        srcBytes: size, outBytes: outSize, stillMissing,
      };
      console.log(`  ✓ ${PATCH.label.padEnd(18)} ${PATCH.src.padEnd(34)} 补 ${baseMissing.length} 个字 -> ${PATCH.out} ${(outSize / 1024).toFixed(1)}KB`
        + (stillMissing ? `（旧字体也没有的：${stillMissing}，只能落到兜底字体）` : ''));
    }
  } else if (!baseMissing) {
    console.log(`  · ${PATCH.label}：${PATCH.base} 一个字都不缺，不需要补丁`);
  }

  // ---- 清单：给 check-content.mjs 守住「内容改了要重跑」 ----
  const { createHash } = await import('node:crypto');
  const manifest = {
    note: '由 tools/subset-fonts.mjs 生成；textSha256 对不上就说明内容改过、子集过期了',
    textSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
    chars: chars.size,
    fonts: produced.map((f) => ({
      out: f.out, src: f.src, label: f.label,
      srcBytes: f.srcBytes, outBytes: f.outBytes,
      codepoints: cov[f.out]?.codepoints ?? 0,
      missingCount: (cov[f.out]?.missing ?? '').length,
      missing: cov[f.out]?.missing ?? '',
    })),
    patch: patchInfo,
  };
  await fs.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`  · 清单写入 assets/fonts/subset-manifest.json（内容指纹 ${manifest.textSha256.slice(0, 12)}）`);
}

console.log(`合计 ${(before / 1048576).toFixed(1)}MB -> ${(after / 1024).toFixed(0)}KB（省掉 ${(100 - (after / before) * 100).toFixed(1)}%）`);
