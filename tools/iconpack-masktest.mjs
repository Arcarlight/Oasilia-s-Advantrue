// iconpack-masktest.mjs — 生成「mask 用 vs <img> 用」对照测试页，并用 Edge 无头渲染截图 + 导出像素统计。
//
// 用法：
//   node tools/iconpack-masktest.mjs --svg <解压出的 svg 根> --png <解压出的 png 根>
// 产出：
//   tools/iconpack-masktest.html        自包含测试页（所有图都内联成 data URI）
//   tools/shots/iconpack-masktest.png   对照截图
//   tools/shots/iconpack-maskstats.txt  像素统计（--dump-dom 导出）

import { spawn } from 'node:child_process';
import fsSync from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const svgRoot = arg('--svg', path.join(process.env.TEMP || '/tmp', 'gip', 'repo', 'game-icon-pack-main', 'svg'));
const pngRoot = arg('--png', path.join(process.env.TEMP || '/tmp', 'gip', 'pngsel'));

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => { try { return !!fsSync.statSync(p); } catch { return false; } })
  || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const SAMPLES = [
  ['boss', '1-game/boss.svg'],
  ['sword', '3-gear/sword.svg'],
  ['coin', '2-items/coin.svg'],
  ['earthquake', '4-nature/earthquake.svg'],
  ['wind', '4-nature/wind.svg'],
  ['arrow-right', '8-ui/arrow-right.svg'],
  ['settings', '8-ui/settings.svg'],
  ['action-points', '1-game/action-points.svg'],
  ['potion', '5-food/potion.svg'],
  ['chest', '2-items/chest.svg'],
  ['tent', '6-buildings/tent.svg'],
  ['tick', '8-ui/tick.svg'],
];

const b64 = (buf) => Buffer.from(buf).toString('base64');
const svgUri = async (rel) => `data:image/svg+xml;base64,${b64(await fs.readFile(path.join(svgRoot, rel)))}`;
const fileUri = async (p) => `data:image/png;base64,${b64(await fs.readFile(p))}`;

const items = [];
for (const [name, rel] of SAMPLES) {
  const np = await svgUri(`no-padding/${rel}`);
  const pd = await svgUri(`padding/${rel}`);
  items.push({
    name, kind: 'svg', np, pd,
    npBytes: (await fs.stat(path.join(svgRoot, 'no-padding', rel))).size,
    pdBytes: (await fs.stat(path.join(svgRoot, 'padding', rel))).size,
  });
}

// PNG 对照（官方发布包里只有黑/白两色，无彩色底块）
for (const [name, p] of [
  ['png-boss-nopad', path.join(pngRoot, 'no-padding/256px/white/1-game/boss.png')],
  ['png-boss-pad', path.join(pngRoot, 'padding/256px/white/1-game/boss.png')],
]) {
  if (!fsSync.existsSync(p)) continue;
  items.push({ name, kind: 'png', np: await fileUri(p), pd: null, npBytes: (await fs.stat(p)).size, pdBytes: 0 });
}
// 现有游戏图标（Kenney 白色剪影）作为基线
for (const b of ['warning', 'coin', 'sword']) {
  const p = path.join(ROOT, 'assets', 'img', 'icons', `${b}.png`);
  const q = path.join(ROOT, 'assets', 'img', 'cards', `${b}.png`);
  const real = fsSync.existsSync(p) ? p : (fsSync.existsSync(q) ? q : null);
  if (real) items.push({ name: `kenney-${b}`, kind: 'baseline', np: await fileUri(real), pd: null, npBytes: (await fs.stat(real)).size, pdBytes: 0 });
}

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>Game Icon Pack - mask vs img</title>
<style>
  :root{--ink:#4a3524;}
  body{margin:0;background:#f3e7cf;color:#3a2a1a;font:13px/1.5 "Segoe UI",system-ui,sans-serif;padding:18px 22px;}
  h1{font-size:19px;margin:0 0 4px} h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #cbb894;padding-bottom:3px}
  .sub{color:#7a6444;font-size:12px;margin-bottom:10px}
  .grid{display:flex;flex-wrap:wrap;gap:14px}
  .cell{background:#fffdf7;border:1px solid #cbb894;border-radius:6px;padding:8px;text-align:center;width:236px}
  .cell .t{font-size:11px;color:#7a6444;margin-bottom:6px}
  .row{display:flex;align-items:flex-end;gap:10px;justify-content:center}
  .box{width:96px;height:96px;background:
      repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px;border:1px dashed #bba57e;}
  /* 方式 A：和游戏现有 .ico-* 完全一样的接法 —— mask + currentColor */
  .mask{background-color:var(--ink);
    -webkit-mask-position:center;mask-position:center;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
    -webkit-mask-size:contain;mask-size:contain;}
  /* 方式 B：直接当原图 <img> */
  .asimg{width:96px;height:96px;display:block;object-fit:contain}
  .lbl{font-size:10px;color:#7a6444;margin-top:3px}
  #stats{font-family:Consolas,monospace;font-size:11.5px;white-space:pre;background:#fffdf7;border:1px solid #cbb894;padding:8px;border-radius:6px}
</style></head><body>
<h1>Game Icon Pack（Nieobie，CC0）— mask vs 原图 &lt;img&gt; 接法对照</h1>
<div class="sub">每个图标左= <b>mask + currentColor</b>（游戏现有 .ico-* 的接法，期待显示成单色剪影）；右= <b>&lt;img&gt; 原图</b>（若自带彩色底块/满幅底色，这里会看到实心方块）。放大到 96px，棋盘格背景用于暴露透明区域。</div>

<h2>1. no-padding 版（紧贴墨迹裁剪）</h2>
<div class="grid" id="g-np"></div>

<h2>2. padding 版（保留 0 0 10 10 原始网格，四周留白）</h2>
<div class="grid" id="g-pd"></div>

<h2>3. 像素统计（浏览器内 canvas 实测；mask 只吃 alpha 通道，故 alpha 覆盖率 = mask 覆盖率）</h2>
<div id="stats">计算中…</div>

<script>
const ITEMS = ${JSON.stringify(items)};
function cell(it, uri, variant, bytes){
  const d=document.createElement('div'); d.className='cell';
  d.innerHTML='<div class="t">'+it.name+' <span style="color:#a08a63">['+variant+'] '+bytes+' B</span></div>'+
    '<div class="row">'+
      '<div><div class="box mask" style="mask-image:url('+JSON.stringify(uri)+');-webkit-mask-image:url('+JSON.stringify(uri)+')"></div><div class="lbl">mask</div></div>'+
      '<div><img class="asimg" src="'+uri+'"><div class="lbl">&lt;img&gt;</div></div>'+
    '</div>';
  return d;
}
for(const it of ITEMS) document.getElementById('g-np').appendChild(cell(it,it.np,'no-padding',it.npBytes));
for(const it of ITEMS) if(it.pd) document.getElementById('g-pd').appendChild(cell(it,it.pd,'padding',it.pdBytes));

function loadImg(src){ return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src;}); }
function statsFor(img,S){
  const c=document.createElement('canvas'); c.width=S; c.height=S;
  const x=c.getContext('2d'); x.clearRect(0,0,S,S); x.drawImage(img,0,0,S,S);
  const d=x.getImageData(0,0,S,S).data;
  let a=0,minx=S,miny=S,maxx=-1,maxy=-1;
  for(let y=0;y<S;y++)for(let px=0;px<S;px++){const i=(y*S+px)*4; const al=d[i+3];
    if(al>8){a++; if(px<minx)minx=px; if(px>maxx)maxx=px; if(y<miny)miny=y; if(y>maxy)maxy=y;}}
  const bw=maxx>=minx?maxx-minx+1:0, bh=maxy>=miny?maxy-miny+1:0;
  return {cov:+(a/(S*S)*100).toFixed(2), bbox:bw+'x'+bh, fullRect:(bw>=S-1&&bh>=S-1&&a/(S*S)>0.9)};
}
(async()=>{
  const S=96, lines=[];
  lines.push('渲染尺寸='+S+'px；“满幅矩形”= 墨迹铺满整框且 alpha 覆盖大于 90%（若为“是”，当 mask 会显示成纯色方块）');
  lines.push('');
  lines.push('图标'.padEnd(18)+'版本'.padEnd(13)+'alpha覆盖%'.padStart(11)+'  墨迹bbox'.padEnd(13)+'  满幅矩形?');
  lines.push('-'.repeat(76));
  for(const it of ITEMS){
    for(const pair of [['no-padding',it.np],['padding',it.pd]]){
      const variant=pair[0], uri=pair[1];
      if(!uri) continue;
      const img=await loadImg(uri);
      if(!img){ lines.push(it.name.padEnd(18)+variant.padEnd(13)+'   载入失败'); continue; }
      const st=statsFor(img,S);
      lines.push(it.name.padEnd(18)+variant.padEnd(13)+String(st.cov).padStart(11)+'  '+st.bbox.padEnd(13)+'  '+(st.fullRect?'!!! 是':'否'));
    }
  }
  document.getElementById('stats').textContent=lines.join('\\n');
  document.title='done';
})();
</script></body></html>`;

const outHtml = path.join(ROOT, 'tools', 'iconpack-masktest.html');
await fs.writeFile(outHtml, html, 'utf8');
console.log('写出测试页:', path.relative(ROOT, outHtml), `(${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);

await fs.mkdir(path.join(ROOT, 'tools', 'shots'), { recursive: true });
const shot = path.join(ROOT, 'tools', 'shots', 'iconpack-masktest.png');
const prof = path.join(ROOT, 'tools', '.edge-profile-verify');

function runEdge(extra) {
  return new Promise((res) => {
    const args = [
      '--headless=new', '--disable-gpu', '--hide-scrollbars',
      '--window-size=1300,2750',
      '--virtual-time-budget=8000', '--no-first-run', '--no-default-browser-check',
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

const r1 = await runEdge(['--screenshot=' + shot]);
console.log(`截图 exit=${r1.code} -> ${path.relative(ROOT, shot)}`);
const r2 = await runEdge(['--dump-dom']);
const m = r2.out.match(/<div id="stats">([\s\S]*?)<\/div>/);
const txt = m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '(未能从 dump-dom 拿到统计)';
await fs.writeFile(path.join(ROOT, 'tools', 'shots', 'iconpack-maskstats.txt'), txt, 'utf8');
console.log('--- 像素统计 ---');
console.log(txt);
if (/载入失败|计算中/.test(txt)) console.log('!! 统计里有失败/未完成，需要人工复核');
