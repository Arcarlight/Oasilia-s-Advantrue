// iconpack-render.mjs — 图标管线的渲染验证：把 content/icons.json 里注册的每个 .ico-* 
// 用真实的 src/ui/style.css（也就是生成区块产出的那套规则）渲染一遍，用 Edge 无头截图 +
// 逐图像素统计，证明「素材接法是对的」：既不是空白，也不是纯色方块。
//
// 用法: node tools/iconpack-render.mjs [--size 96] [--no-shot]
// 产出:
//   tools/iconpack-render.html            对照页（真的加载 ../../src/ui/style.css，不是内联副本）
//   tools/shots/iconpack-render.png       整页截图（Edge 无头，1300+ 宽）
//   tools/shots/iconpack-render-stats.txt 逐图像素统计（alpha 覆盖率 / 墨迹 bbox / 判定）
import { spawn } from 'node:child_process';
import fsSync from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SIZE = Number(arg('--size', 96));
const NO_SHOT = argv.includes('--no-shot');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => { try { return !!fsSync.statSync(p); } catch { return false; } });
if (!EDGE) {
  console.error('找不到 Edge（msedge.exe），无法做渲染验证。');
  process.exit(1);
}

const registry = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'icons.json'), 'utf8'));
const css = await fs.readFile(path.join(ROOT, 'src', 'ui', 'style.css'), 'utf8');
const genMatch = css.match(/\/\* #region GENERATED-ICONS \*\/([\s\S]*?)\/\* #endregion GENERATED-ICONS \*\//);
if (!genMatch) {
  console.error('style.css 里没有 GENERATED-ICONS 区块 —— 先跑 node tools/build-content.mjs');
  process.exit(1);
}
const gen = genMatch[1];
const defined = new Map([...gen.matchAll(/\.ico-([a-z0-9_]+) \{ \/\* (.*?) \*\/\s*-webkit-mask-image: url\(([^)]+)\);/gs)]
  .map((m) => [m[1], { desc: m[2], url: m[3] }]));

const icons = [];
for (const it of registry.icons) {
  const rule = defined.get(it.name);
  if (!rule) { console.error(`! style.css 生成区块里没有 .ico-${it.name}（注册表和 CSS 不同步？）`); process.exit(1); }
  const rel = rule.url.replace(/^\.\.\/\.\.\//, '');
  const abs = path.join(ROOT, rel);
  const exists = fsSync.existsSync(abs);
  icons.push({
    name: it.name,
    cls: 'ico-' + it.name,
    group: it.group ?? '未分组',
    desc: it.desc ?? rule.desc,
    source: it.source,
    rel,
    url: rule.url,
    // canvas 读像素要求 CORS 干净：file:// 下的子资源直接给 <img>/canvas 用会被当成跨源，
    // 所以脚本用 file:/// 绝对路径自己去 fetch 字节（Edge 带 --allow-file-access-from-files 跑）
    fileUrl: 'file:///' + abs.replace(/\\/g, '/').replace(/ /g, '%20'),
    bytes: exists ? fsSync.statSync(abs).size : 0,
  });
}

// 页面里的行：每行一个图标，mask 与「原图 <img>」并排，方便肉眼对照。
// 关键点：这里用的是真实 style.css 里的 .ico-* 类，而不是把 SVG 内联成 data URI，
// 所以它验证的就是「游戏实际会怎么渲染」。
const rows = icons.map((i) => `      <div class="cell" data-name="${i.name}">
        <div class="box"><span class="${i.cls} big"></span></div>
        <div class="nm">${i.cls}</div>
        <div class="meta">${i.source}<br>${(i.bytes / 1024).toFixed(1)} KB · ${i.group}</div>
      </div>`).join('\n');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>icons pipeline render check</title>
<link rel="stylesheet" href="../src/ui/style.css">
<style>
  body{margin:0;padding:16px 18px;background:#20160e;color:#f0dcbd;font:13px/1.5 "Segoe UI",system-ui,sans-serif}
  h1{font-size:19px;margin:0 0 2px}
  .sub{color:#c8ab7e;font-size:12px;margin-bottom:12px}
  .grid{display:flex;flex-wrap:wrap;gap:10px}
  .cell{width:150px;background:#2c1f14;border:1px solid #5a4426;border-radius:8px;padding:8px 6px;text-align:center}
  .box{height:${SIZE}px;display:grid;place-items:center;
       background:repeating-conic-gradient(#3a2a1a 0 25%,#241a11 0 50%) 0 0/16px 16px;border-radius:6px}
  /* 和游戏里一样：mask + currentColor（这里的 currentColor 来自 body 的 #f0dcbd） */
  .big{width:${SIZE}px;height:${SIZE}px;background-color:currentColor}
  .nm{font:11.5px/1.4 Consolas,monospace;color:#ffd98a;margin-top:5px}
  .meta{font-size:10px;color:#a68c66;word-break:break-all}
  #stats{font-family:Consolas,monospace;font-size:11.5px;white-space:pre;background:#160f09;border:1px solid #5a4426;padding:10px;border-radius:8px;margin-top:16px}
  #probe{position:absolute;left:-9999px;top:0}
</style></head><body>
<h1>图标管线渲染验证（content/icons.json -> style.css GENERATED-ICONS -> assets/img）</h1>
<div class="sub">每个图标都用游戏里真实的 <b>.ico-* 类</b>（mask-image + currentColor）渲染在棋盘格上：空白 = 素材没接上，整块实心 = mask 被当成纯色方块。共 ${icons.length} 个。</div>
<div class="grid">
${rows}
</div>
<div id="stats">计算中…</div>
<div id="probe"></div>
<script>
const ICONS = ${JSON.stringify(icons.map((i) => ({ name: i.name, cls: i.cls, url: i.url, file: i.fileUrl })))};
const SIZE = ${SIZE};
async function renderOne(icon) {
  // 只保留素材的 alpha 通道（等价于 mask 只吃 alpha），几何按 mask-size:contain 等比缩放。
  // 先把文件读成 blob URL 再交给 <img>，这样 canvas 是 CORS 干净的（file:// 下拿原路径会污染 canvas）。
  const blobUrl = await fetch(icon.file)
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => (b ? URL.createObjectURL(b) : null))
    .catch(() => null);
  if (!blobUrl) return null;
  const img = new Image();
  const ready = new Promise((r) => { img.onload = () => r(true); img.onerror = () => r(false); });
  img.src = blobUrl;
  if (!(await ready)) { URL.revokeObjectURL(blobUrl); return null; }
  const nw = img.naturalWidth || SIZE, nh = img.naturalHeight || SIZE;
  const k = Math.min(SIZE / nw, SIZE / nh, SIZE / Math.max(nw, nh));
  const dw = Math.max(1, Math.round(nw * k)), dh = Math.max(1, Math.round(nh * k));
  const c = document.createElement('canvas'); c.width = SIZE; c.height = SIZE;
  const x = c.getContext('2d');
  x.clearRect(0, 0, SIZE, SIZE);
  x.drawImage(img, Math.round((SIZE - dw) / 2), Math.round((SIZE - dh) / 2), dw, dh);
  URL.revokeObjectURL(blobUrl);
  const d = x.getImageData(0, 0, SIZE, SIZE).data;
  let a = 0, minx = SIZE, miny = SIZE, maxx = -1, maxy = -1;
  for (let py = 0; py < SIZE; py++) for (let px = 0; px < SIZE; px++) {
    const al = d[(py * SIZE + px) * 4 + 3];
    if (al > 8) { a++; if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py; }
  }
  const bw = maxx >= minx ? maxx - minx + 1 : 0, bh = maxy >= miny ? maxy - miny + 1 : 0;
  const cov = a / (SIZE * SIZE);
  return { cov: +(cov * 100).toFixed(2), bbox: bw + 'x' + bh, blank: a < SIZE * SIZE * 0.01, solid: (cov > 0.9 && bw >= SIZE * 0.98 && bh >= SIZE * 0.98) };
}
(async () => {
  const lines = [];
  lines.push('渲染尺寸=' + SIZE + 'px；“空白”= 不透明像素 <1%；“纯色方块”= 覆盖率 >90% 且墨迹铺满整框');
  lines.push('');
  lines.push('图标'.padEnd(22) + 'alpha覆盖%'.padStart(10) + '  墨迹bbox'.padEnd(12) + '判定');
  lines.push('-'.repeat(72));
  let blank = 0, solid = 0, sum = 0, minCov = 999, maxCov = -1, minName = '', maxName = '';
  for (const it of ICONS) {
    const st = await renderOne(it);
    if (!st) { lines.push(it.name.padEnd(22) + '   素材载入失败'); blank++; continue; }
    const verdict = st.blank ? '!! 空白' : (st.solid ? '!! 纯色方块' : 'OK');
    if (st.blank) blank++;
    if (st.solid) solid++;
    if (!st.blank) { sum += st.cov; if (st.cov < minCov) { minCov = st.cov; minName = it.name; } if (st.cov > maxCov) { maxCov = st.cov; maxName = it.name; } }
    lines.push(it.name.padEnd(22) + String(st.cov).padStart(10) + '  ' + st.bbox.padEnd(12) + verdict);
  }
  lines.push('');
  lines.push('汇总: 共 ' + ICONS.length + ' 个 · 空白 ' + blank + ' · 纯色方块 ' + solid +
    ' · 覆盖率 ' + (minCov === 999 ? '-' : (minCov + '% (' + minName + ') ~ ' + maxCov + '% (' + maxName + ')')) +
    ' · 平均 ' + (ICONS.length ? (sum / (ICONS.length - blank)).toFixed(1) : '-') + '%');
  document.getElementById('stats').textContent = lines.join('\\n');
  document.title = blank || solid ? 'FAIL' : 'OK';
})();
</script></body></html>`;

const outHtml = path.join(ROOT, 'tools', 'iconpack-render.html');
await fs.writeFile(outHtml, html, 'utf8');
const relHtml = path.relative(ROOT, outHtml);
console.log(`测试页: ${relHtml}（${icons.length} 个图标 · 真实 style.css 的 .ico-* 规则）`);

await fs.mkdir(path.join(ROOT, 'tools', 'shots'), { recursive: true });
const shot = path.join(ROOT, 'tools', 'shots', 'iconpack-render.png');
const prof = path.join(ROOT, 'tools', '.edge-profile-iconrender');

function runEdge(extra) {
  return new Promise((res) => {
    const args = [
      '--headless=new', '--disable-gpu', '--hide-scrollbars',
      '--window-size=1320,2500',
      '--virtual-time-budget=15000', '--no-first-run', '--no-default-browser-check',
      '--allow-file-access-from-files',
      '--user-data-dir=' + prof,
      ...extra,
      'file:///' + outHtml.replace(/\\/g, '/'),
    ];
    const c = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    c.stdout.on('data', (d) => { out += d.toString(); });
    c.stderr.on('data', (d) => { out += d.toString(); });
    c.on('close', (code) => res({ code, out }));
  });
}

if (!NO_SHOT) {
  const r1 = await runEdge(['--screenshot=' + shot]);
  const st = fsSync.existsSync(shot) ? fsSync.statSync(shot) : null;
  console.log(`截图 exit=${r1.code} -> ${path.relative(ROOT, shot)}${st ? ` (${(st.size / 1024).toFixed(0)} KB)` : '（没有生成）'}`);
  if (!st) { console.error('截图失败，原样打印浏览器输出：\n' + r1.out.slice(0, 2000)); process.exit(1); }
}

const r2 = await runEdge(['--dump-dom']);
const m = r2.out.match(/<div id="stats">([\s\S]*?)<\/div>/);
const txt = m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '';
if (!txt || /计算中/.test(txt)) {
  console.error('没拿到像素统计（页面脚本没跑完？）。浏览器输出：\n' + r2.out.slice(0, 2000));
  process.exit(1);
}
const statsPath = path.join(ROOT, 'tools', 'shots', 'iconpack-render-stats.txt');
await fs.writeFile(statsPath, txt + '\n', 'utf8');
console.log('像素统计: ' + path.relative(ROOT, statsPath));
console.log('--- 像素统计 ---');
console.log(txt);

const badBlank = /!! 空白/.test(txt);
const badSolid = /!! 纯色方块/.test(txt);
const loadFail = /素材载入失败/.test(txt);
if (badBlank || badSolid || loadFail) {
  console.error('\n!! 渲染验证没通过（空白 / 纯色方块 / 素材载入失败），见上面的表。');
  process.exit(1);
}
console.log('\n渲染验证通过：没有空白、没有纯色方块，所有素材都载入成功。');
