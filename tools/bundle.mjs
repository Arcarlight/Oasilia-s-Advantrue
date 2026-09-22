// 把整个游戏打包成「双击就能玩」的单文件 HTML。
//
// 为什么需要它：浏览器不允许用 file:// 加载 ES module（origin 为 null 会被 CORS 拦掉），
// 所以直接双击 index.html 只会看到背景。这个脚本把模块合成一个经典 <script>，
// 并把 CSS 与精灵元数据一起内联，产物不依赖 module / fetch 也能跑。
//
// 用法: node tools/bundle.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const ENTRY = path.join(ROOT, 'src', 'main.js');
const OUT = path.join(ROOT, 'oasis-game.html');

// ---------------------------------------------------------------
// 1. 收集模块依赖图
// ---------------------------------------------------------------
const IMPORT_RE = /(^|\n)[ \t]*import\s+([\s\S]*?)\s+from\s*['"]([^'"]+)['"]\s*;?/g;

async function loadModule(absPath) {
  const code = await fs.readFile(absPath, 'utf8');
  const deps = [];
  for (const m of code.matchAll(IMPORT_RE)) {
    const rel = m[3];
    if (!rel.startsWith('.')) continue; // 本项目没有裸模块
    deps.push(path.resolve(path.dirname(absPath), rel));
  }
  return { absPath, code, deps };
}

const modules = new Map(); // absPath -> {absPath, code, deps}
const order = [];
async function walk(absPath) {
  if (modules.has(absPath)) return;
  const mod = await loadModule(absPath);
  modules.set(absPath, mod);
  for (const d of mod.deps) await walk(d);
  order.push(absPath); // 后序：叶子在前
}
await walk(ENTRY);

// ---------------------------------------------------------------
// 2. 把每个模块改写成工厂函数
// ---------------------------------------------------------------
const idOf = (absPath) => path.relative(ROOT, absPath).replace(/\\/g, '/');
const factories = [];

for (const absPath of order) {
  const mod = modules.get(absPath);
  const id = idOf(absPath);
  let code = mod.code;

  // 2a. import -> 从 registry 解构 + 记录依赖
  // 注意：替换文本要用「函数返回值」而不是字符串，否则 $&、$' 这些会被当成替换模式。
  const importIds = [];
  code = code.replace(IMPORT_RE, (_full, lead, clauseText, rel) => {
    const depAbs = path.resolve(path.dirname(absPath), rel);
    const depId = idOf(depAbs);
    importIds.push(depId);
    const nl = lead.includes('\n') ? '\n' : ' ';
    const clause = clauseText.replace(/\s+/g, ' ').trim();
    if (clause.startsWith('{')) {
      // 命名导入：{ a, b as c }  ->  const { a, b: c } = __mods[...]
      const inner = clause.slice(1, clause.lastIndexOf('}'));
      const pairs = inner
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const asMatch = s.split(/\s+as\s+/);
          return asMatch.length === 2 ? `${asMatch[0].trim()}: ${asMatch[1].trim()}` : s;
        });
      return `${nl}const { ${pairs.join(', ')} } = __mods[${JSON.stringify(depId)}];`;
    }
    if (clause.startsWith('*')) {
      // import * as ns from '...'
      const ns = clause.split(/\s+as\s+/)[1]?.trim() ?? '__ns';
      return `${nl}const ${ns} = __mods[${JSON.stringify(depId)}];`;
    }
    // 默认导入
    return `${nl}const ${clause} = __mods[${JSON.stringify(depId)}].default;`;
  });

  // 2b. 动态 import（本项目只用于延迟加载界面）—— 直接换成同步取模块
  code = code.replace(/await import\(\s*['"]([^'"]+)['"]\s*\)/g, (_full, rel) => {
    const depId = idOf(path.resolve(path.dirname(absPath), rel));
    importIds.push(depId);
    return `__mods[${JSON.stringify(depId)}]`;
  });

  // 2c. export -> 收集导出名 + 去掉关键字
  const named = [];
  let hasDefault = false;

  // 先处理「重命名导出」：export { KEY as SAVE_KEY } —— 直接补一条别名语句
  const aliasStatements = [];
  code = code.replace(/\bexport\s*\{([^}]*)\}\s*;?/g, (_f, inner) => {
    for (const raw of inner.split(',')) {
      const s = raw.trim();
      if (!s) continue;
      const parts = s.split(/\s+as\s+/);
      const local = parts[0].trim();
      const exported = (parts[1] ?? parts[0]).trim();
      if (local === exported) {
        named.push(exported);
      } else {
        // 用别名 const 代替，避免重命名导出被丢掉导致「X is not defined」
        aliasStatements.push(`  const ${exported} = ${local};`);
        named.push(exported);
      }
    }
    return '';
  });

  // export const/let/function/class Name（同时支持 export async function / export function*）
  code = code.replace(
    /\bexport\s+(?:(async)\s+)?(const|let|var|function|class)(\s*\*)?\s+([A-Za-z_$][\w$]*)/g,
    (_f, asyncKw, kind, star, name) => {
      named.push(name);
      return `${asyncKw ? asyncKw + ' ' : ''}${kind}${star ?? ''} ${name}`;
    },
  );
  // export default xxx
  if (/\bexport\s+default\b/.test(code)) {
    hasDefault = true;
    code = code.replace(/\bexport\s+default\s+/, 'const __default = ');
  }
  // 兜底：任何残留的 export
  code = code.replace(/\bexport\s+/g, '');

  if (aliasStatements.length) code += `\n${aliasStatements.join('\n')}\n`;

  const uniq = [...new Set(named)];
  const exportsObj = [
    ...uniq.map((n) => `${JSON.stringify(n)}: ${n}`),
    ...(hasDefault ? ['default: __default'] : []),
  ].join(', ');

  factories.push(
    `__def(${JSON.stringify(id)}, [${importIds.map((d) => JSON.stringify(d)).join(', ')}], function () {\n${code}\nreturn { ${exportsObj} };\n});`,
  );
}

// ---------------------------------------------------------------
// 3. 内联 CSS 与精灵元数据
// ---------------------------------------------------------------
let css = await fs.readFile(path.join(ROOT, 'src', 'ui', 'style.css'), 'utf8');
// CSS 里是 ../../assets/...（相对于 src/ui/），单文件里要变成 assets/...
css = css.replace(/\.\.\/\.\.\/assets\//g, 'assets/');

// 字体也内联：file:// 下 CSS 里的 url() 会被拦掉，内联之后离线版也能用上自定义字体。
// 正文字体挺大（LXGW 8.5MB → base64 约 11MB），但只有这一处，换来的是「双击也能用对字体」。
// 另外三套是**按用到的字裁过的子集**（tools/subset-fonts.mjs，合计约 1.4MB），
// 不裁的话这三个加起来 46MB，光内联就 61MB。
const FONT_RE = /url\((['"]?)(assets\/fonts\/[^'")]+)\1\)/g;
for (const m of [...css.matchAll(FONT_RE)]) {
  const rel = m[2];
  try {
    const buf = await fs.readFile(path.join(ROOT, rel));
    // MIME 跟着扩展名走：woff2 写成 font/ttf 的话浏览器会拒绝解析（静默不成字）
    const ext = path.extname(rel).toLowerCase();
    const mime = ext === '.woff2' ? 'font/woff2' : ext === '.woff' ? 'font/woff' : 'font/ttf';
    const uri = `data:${mime};base64,${buf.toString('base64')}`;
    css = css.split(`url(${rel})`).join(`url(${uri})`);
    css = css.split(`url('${rel}')`).join(`url(${uri})`);
    css = css.split(`url("${rel}")`).join(`url(${uri})`);
    console.log(`字体内联: ${rel}（${(buf.length / 1024 / 1024).toFixed(1)} MB，${mime}）`);
  } catch {
    console.warn('  字体缺失，跳过内联:', rel);
  }
}

// file:// 下浏览器会把 CSS 里引用的本地图片也当成跨源请求拦掉，
// 所以把用到的素材直接内联成 data URI（图标都很小，代价可以接受）。
const URL_RE = /url\((['"]?)(assets\/[^'")]+)\1\)/g;
const assetPaths = [...new Set([...css.matchAll(URL_RE)].map((m) => m[2]))];
let inlined = 0;
let inlinedBytes = 0;
for (const rel of assetPaths) {
  const abs = path.join(ROOT, rel);
  let buf;
  try {
    buf = await fs.readFile(abs);
  } catch {
    console.warn('  素材缺失，跳过内联:', rel);
    continue;
  }
  const ext = path.extname(rel).toLowerCase();
  const mime = ext === '.png' ? 'image/png'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.webp' ? 'image/webp'
    : ext === '.svg' ? 'image/svg+xml'
    : 'application/octet-stream';
  const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
  css = css.split(`url(${rel})`).join(`url(${dataUri})`);
  css = css.split(`url('${rel}')`).join(`url(${dataUri})`);
  css = css.split(`url("${rel}")`).join(`url(${dataUri})`);
  inlined++;
  inlinedBytes += buf.length;
}
console.log(`CSS 内联素材: ${inlined}/${assetPaths.length} 个（原始 ${(inlinedBytes / 1024).toFixed(1)} KB）`);

const spritesJson = await fs.readFile(path.join(ROOT, 'assets', 'data', 'sprites.json'), 'utf8');
const spritesB64 = Buffer.from(spritesJson, 'utf8').toString('base64');

// 精灵图也内联：file:// 下 <img src="assets/...png"> 会被当成跨源请求拦掉，
// 而且 canvas 逐帧裁切需要图能正常 onload。总共约 1.3MB，base64 之后 ~1.8MB。
const pkmDir = path.join(ROOT, 'assets', 'pokemon');
const spriteMap = {};
let spriteBytes = 0;
for (const slug of await fs.readdir(pkmDir)) {
  const dir = path.join(pkmDir, slug);
  const st = await fs.stat(dir).catch(() => null);
  if (!st?.isDirectory()) continue;
  for (const file of await fs.readdir(dir)) {
    if (!file.endsWith('.png')) continue;
    const anim = path.basename(file, '.png');
    const buf = await fs.readFile(path.join(dir, file));
    spriteMap[`${slug}/${anim}`] = `data:image/png;base64,${buf.toString('base64')}`;
    spriteBytes += buf.length;
  }
}
console.log(`精灵图内联: ${Object.keys(spriteMap).length} 张（原始 ${(spriteBytes / 1024).toFixed(0)} KB）`);

// 头像（PMD portrait）也内联：每张只有 1~2 KB，全部加起来约 1 MB
const portraitDir = path.join(ROOT, 'assets', 'portraits');
const portraitMap = {};
let portraitBytes = 0;
for (const slug of await fs.readdir(portraitDir).catch(() => [])) {
  const dir = path.join(portraitDir, slug);
  const st = await fs.stat(dir).catch(() => null);
  if (!st?.isDirectory()) continue;
  for (const file of await fs.readdir(dir)) {
    if (!file.endsWith('.png')) continue;
    const emotion = path.basename(file, '.png');
    const buf = await fs.readFile(path.join(dir, file));
    portraitMap[`${slug}/${emotion}`] = `data:image/png;base64,${buf.toString('base64')}`;
    portraitBytes += buf.length;
  }
}
console.log(`头像内联: ${Object.keys(portraitMap).length} 张（原始 ${(portraitBytes / 1024).toFixed(0)} KB）`);

// 小图标（Generation 9 Pack 的 animated Icons）也内联：一只一张、每张 1~4 KB
const iconDir = path.join(ROOT, 'assets', 'icons');
const iconMap = {};
let iconBytes = 0;
for (const file of await fs.readdir(iconDir).catch(() => [])) {
  if (!file.endsWith('.png')) continue;
  const slug = path.basename(file, '.png');
  const buf = await fs.readFile(path.join(iconDir, file));
  iconMap[slug] = `data:image/png;base64,${buf.toString('base64')}`;
  iconBytes += buf.length;
}
console.log(`小图标内联: ${Object.keys(iconMap).length} 张（原始 ${(iconBytes / 1024).toFixed(0)} KB）`);

// 回合切换立绘（正/背面）也内联：168 张裁切后总共只有 200 KB 左右
const gen9Dir = path.join(ROOT, 'assets', 'gen9');
const gen9Map = {};
let gen9Bytes = 0;
for (const slug of await fs.readdir(gen9Dir).catch(() => [])) {
  const dir = path.join(gen9Dir, slug);
  const st = await fs.stat(dir).catch(() => null);
  if (!st?.isDirectory()) continue;
  for (const file of await fs.readdir(dir)) {
    if (!file.endsWith('.png')) continue;
    const kind = path.basename(file, '.png');
    const buf = await fs.readFile(path.join(dir, file));
    gen9Map[`${slug}/${kind}`] = `data:image/png;base64,${buf.toString('base64')}`;
    gen9Bytes += buf.length;
  }
}
console.log(`立绘内联: ${Object.keys(gen9Map).length} 张（原始 ${(gen9Bytes / 1024).toFixed(0)} KB）`);

// 精灵数据直接内联，省掉一次 fetch（file:// 下 fetch 也会被拦）
const spriteInline = `
<script>
  // 精灵帧尺寸元数据（由 tools/build-sprite-meta.mjs 生成后内联）
  window.__OASIS_SPRITE_META__ = JSON.parse(atob("${spritesB64}"));
</script>
<script>
  // 精灵图本体（data URI），键是 "物种slug/动画名"
  window.__OASIS_SPRITES__ = ${JSON.stringify(spriteMap)};
</script>
<script>
  // 表情头像（data URI），键是 "物种slug/表情名"
  window.__OASIS_PORTRAITS__ = ${JSON.stringify(portraitMap)};
</script>
<script>
  // 小图标（Generation 9 Pack 的 animated Icons，data URI），键是物种 slug
  window.__OASIS_ICONS__ = ${JSON.stringify(iconMap)};
</script>
<script>
  // 回合切换立绘（data URI），键是 "物种slug/front|back"
  window.__OASIS_GEN9__ = ${JSON.stringify(gen9Map)};
</script>`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>欧亚西莉亚的大冒险 ～ Desert Spirit.</title>
<!-- 标签页图标：和 index.html 必须是同一份（tools/check-copy.mjs 第 ⑦ 条会比对标题与图标，
     两边走散就红）。单文件包与 assets/ 同目录，所以这个相对路径同样有效。 -->
<link rel="icon" type="image/x-icon" href="assets/img/flygon_ico.ico" />
<style>
${css}
</style>
${spriteInline}
</head>
<body>
<div id="app">
  <header id="hud" class="hud hidden">
    <div class="hud-left">
      <div class="hud-portrait" id="hud-portrait"></div>
      <div class="hud-ident">
        <div class="hud-name"><span id="hud-name">Oasis</span> <span class="gender">♀</span></div>
        <div class="hud-species" id="hud-species">沙漠蜻蜓 · 地面/龙</div>
      </div>
      <div class="hud-hp">
        <div class="hp-bar"><div class="hp-fill" id="hud-hp-fill"></div><span id="hud-hp-text">200 / 200</span></div>
      </div>
      <div class="hud-stats" id="hud-stats"></div>
    </div>
    <div class="hud-right">
      <div class="gold-pill"><span class="ico-money"></span><span id="hud-gold">0</span></div>
      <!-- 背包：战斗中 / 商店里都能随手看一眼身上带着什么（按 I 同效）。
           右上角这一排是「随时可查」的四件事：道具 / 卡组 / 图鉴 / 设置。
           悬停文字由 src/ui/hud.js 按当前语言写进去（这里这份是 JS 跑起来之前的默认值），
           单文件包里那份是 tools/bundle.mjs 里抄的第二份，两边必须一字不差（check-copy 第 ⑦ 条）。 -->
      <button class="btn btn-icon" id="btn-items" title="背包：身上带着的道具（按 I）"><span class="ico-backpack"></span><span class="hud-count" id="hud-held-count"></span></button>
      <button class="btn btn-icon" id="btn-deck" title="查看卡组（只读：排序 / 卡牌详情 / 图鉴）"><span class="ico-cards"></span></button>
      <button class="btn btn-icon" id="btn-codex" title="敌人图鉴（按 E）"><span class="ico-book"></span></button>
      <button class="btn btn-icon" id="btn-settings" title="设置"><span class="ico-gear"></span></button>
    </div>
  </header>

  <main id="stage" class="stage">
    <div class="screen title-screen">
      <div class="title-inner">
        <div class="title-hero"><h1 class="title-h1" style="font-size:34px">正在吹起沙暴…</h1></div>
        <p class="title-quote">正在加载宝可梦精灵与卡牌数据</p>
      </div>
    </div>
  </main>

  <footer id="toast" class="toast hidden"></footer>
</div>
<div id="modal-root"></div>
<div id="float-layer" class="float-layer"></div>

<script>
/* ============================================================
   沙漠精灵 Oasis —— 单文件构建（由 tools/bundle.mjs 生成）
   这样直接双击 HTML 也能玩：不依赖 ES module，也不依赖 fetch。
   源码仍在 src/ 下；改完源码请重新运行 node tools/bundle.mjs
   ============================================================ */
(function () {
  'use strict';

  // ---- 极简模块系统：__def 注册工厂，__mods 缓存实例 ----
  var __mods = {};
  function __def(id, deps, factory) {
    if (__mods[id]) return;
    var m = factory();
    __mods[id] = m;
  }

${factories.join('\n\n')}

})();
</script>
</body>
</html>
`;

await fs.writeFile(OUT, html, 'utf8');
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`打包完成：${path.relative(ROOT, OUT)}（${kb} KB，${order.length} 个模块）`);
console.log('双击这个文件就能玩（需要 assets/ 与它同目录）。');
