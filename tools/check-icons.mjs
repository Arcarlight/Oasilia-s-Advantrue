// 检查 src 里用到的所有 ico-* 类名是否都真的有对应素材。
//
// .ico-* 的定义全部由 content/icons.json 生成进 src/ui/style.css 的 GENERATED-ICONS 区块
// （node tools/build-content.mjs）。注册了但暂时没人用的图标是**正常**的：
// 注册表是给后续改造备的货架，所以这里只把它们列出来，不算失败。
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

// 从 style.css 里收集 .ico-xxx 的 mask 定义
const css = await fs.readFile(path.join(ROOT, 'src', 'ui', 'style.css'), 'utf8');
const defined = new Set([...css.matchAll(/\.ico-([a-z0-9_]+)\s*\{/g)].map((m) => m[1]));

// 从各个 js 文件里收集用到的类名
const used = new Map();
async function walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { await walk(p); continue; }
    if (!e.name.endsWith('.js')) continue;
    const text = await fs.readFile(p, 'utf8');
    for (const m of text.matchAll(/ico-([a-z0-9_]+)/g)) {
      if (!used.has(m[1])) used.set(m[1], new Set());
      used.get(m[1]).add(path.relative(ROOT, p));
    }
  }
}
await walk(path.join(ROOT, 'src'));

const missing = [...used.keys()].filter((k) => !defined.has(k)).sort();
const unused = [...defined].filter((k) => !used.has(k)).sort();

console.log(`style.css 的 GENERATED-ICONS 区块定义了 ${defined.size} 个图标类（来自 content/icons.json），src 里用到 ${used.size} 个。`);
if (missing.length) {
  console.log('\n❌ 代码里用了但 CSS 没定义（会显示成空白方块）：');
  for (const m of missing) console.log(`   ico-${m}   ← ${[...used.get(m)].join(', ')}`);
} else {
  console.log('\n✅ 所有用到的图标类都有定义。');
}
if (unused.length) {
  console.log(`\n（已注册、暂时没人用：${unused.length} 个 —— 注册表是后续改造的货架，不算问题）`);
  console.log(`   ${unused.join(', ')}`);
}

// 再检查 mask 指向的文件是否存在
const files = [...css.matchAll(/url\(\.\.\/\.\.\/([^)]+)\)/g)].map((m) => m[1]);
let bad = 0;
for (const f of files) {
  try { await fs.access(path.join(ROOT, f)); } catch { console.log(`❌ 素材缺失: ${f}`); bad++; }
}
console.log(bad ? `\n共 ${bad} 个素材文件缺失。` : `\n✅ 引用的 ${files.length} 个素材文件都存在。`);

// 退出码：报错了就必须非 0，否则任何按退出码判定的门禁（CI、npm script、别的脚本）
// 都拦不住 —— 这个洞是 tools/ 自检时用「故意写个不存在的 ico-*」反例测出来的：
// 当时错误文本打印了、exit code 却是 0。
if (missing.length || bad) {
  console.log(`\n❌ 检查未通过：${missing.length} 个类名没定义、${bad} 个素材缺失。`);
  process.exitCode = 1;
}
