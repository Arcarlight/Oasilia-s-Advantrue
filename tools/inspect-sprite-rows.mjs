// 把精灵图按行切开拼成对照表，用来判断每一行到底是哪个朝向。
// 用法: node tools/inspect-sprite-rows.mjs flygon Idle
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const slug = process.argv[2] ?? 'flygon';
const anim = process.argv[3] ?? 'Idle';

const meta = JSON.parse(await fs.readFile(path.join(ROOT, 'assets', 'data', 'sprites.json'), 'utf8'));
const info = meta[slug].anims[anim];

const PNG = path.join(ROOT, 'assets', 'pokemon', slug, `${anim}.png`);
const b64 = (await fs.readFile(PNG)).toString('base64');

const OUT = path.join(ROOT, 'tools', 'shots', `rows-${slug}-${anim}.png`);
const TEST = path.join(ROOT, 'sprite-rows.html');

const SCALE = 2;
const W = info.cols * info.fw * SCALE;
const H = info.rows * info.fh * SCALE + info.rows * 22;

await fs.writeFile(TEST, `<!DOCTYPE html>
<html><body style="margin:0;background:#1a120c">
<canvas id="cv" width="${W}" height="${H}"></canvas>
<script>
const meta = ${JSON.stringify(info)};
const img = new Image();
img.onload = () => {
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1a120c';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const S = ${SCALE};
  for (let r = 0; r < meta.rows; r++) {
    const y = r * (meta.fh * S + 22);
    // 行号标签
    ctx.fillStyle = '#ffd76e';
    ctx.font = '14px sans-serif';
    ctx.fillText('row ' + r, 4, y + 14);
    // 网格线
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath();
    ctx.moveTo(0, y + 20); ctx.lineTo(cv.width, y + 20);
    ctx.stroke();
    for (let c = 0; c < meta.cols; c++) {
      const x = c * meta.fw * S;
      // 交替底色，方便看清单帧边界
      ctx.fillStyle = (c % 2 === 0) ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.01)';
      ctx.fillRect(x, y + 20, meta.fw * S, meta.fh * S);
      ctx.drawImage(img, c * meta.fw, r * meta.fh, meta.fw, meta.fh, x, y + 20, meta.fw * S, meta.fh * S);
    }
  }
  window.__done = true;
  console.log('[rows] drawn ' + meta.rows + ' rows x ' + meta.cols + ' cols');
};
img.src = 'data:image/png;base64,${b64}';
</script></body></html>`, 'utf8');

const args = [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--window-size=${Math.min(W, 2000)},${Math.min(H, 2000)}`,
  '--virtual-time-budget=9000',
  '--screenshot=' + OUT,
  '--enable-logging=stderr', '--v=0',
  '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + path.join(ROOT, 'tools', '.edge-rows'),
  'http://127.0.0.1:5123/sprite-rows.html',
];
const child = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
child.stderr.on('data', (d) => { out += d.toString(); });
const code = await new Promise((r) => child.on('close', r));

for (const l of out.split(/\r?\n/)) if (/\[rows\]/.test(l)) console.log('  ' + l.replace(/^.*INFO:CONSOLE:\d+\]\s*/, ''));
console.log(`截图: ${path.relative(ROOT, OUT)}  canvas ${W}x${H}`);

await fs.rm(TEST, { force: true });
await fs.rm(path.join(ROOT, 'tools', '.edge-rows'), { recursive: true, force: true });
