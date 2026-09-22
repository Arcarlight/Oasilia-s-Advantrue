// 量战斗界面的**真实帧率**（3.0.7）。
//
// 为什么不能用现成的两个工具：
//   · tools/shot.mjs 截图走 `--virtual-time-budget`（定时器与 CSS 动画被一路快进），
//     帧间隔毫无意义 —— 截图永远「很流畅」；
//   · tools/smoke-check.mjs 同样跑在虚拟时间下，而且它是断言不是测量。
// 所以这个脚本用**真实时间**跑一个 headless Edge：不设虚拟时间、不截图，让它开 8 秒，
// 读页面自己打的 `[fps] ...` 日志（页面侧的量法见 src/main.js 的 ?fps=1）。
//
// 那个日志里有两条：**花纹动** 与 **花纹停**（临时关掉花纹动画再测一轮）——
// 两条的差值就是「这层装饰吃掉了多少帧」。
//
// 用法：node tools/measure-fps.mjs [url 附加参数]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => p);
const EXTRA = process.argv[2] ?? 'scene=battle';
const URL_ = `http://127.0.0.1:5123/?${EXTRA}&fps=1`;

const args = [
  '--headless=new',
  '--window-size=1440,900',
  '--enable-logging=stderr',
  '--v=0',
  '--no-first-run',
  '--no-default-browser-check',
  '--mute-audio',
  '--user-data-dir=' + path.join(ROOT, 'tools', '.edge-profile'),
  URL_,
];

console.log(`真实时间跑一次 headless Edge：${URL_}`);
const child = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
child.stderr.on('data', (d) => { out += d.toString(); });
child.stdout.on('data', (d) => { out += d.toString(); });

// 页面侧 2.2s 之后才开始测，两轮各 3.5s —— 10 秒足够，之后主动收掉
const code = await new Promise((resolve) => {
  const timer = setTimeout(() => { child.kill(); resolve(null); }, 11000);
  child.on('close', (c) => { clearTimeout(timer); resolve(c); });
});
void code;

const lines = out.split(/\r?\n/).filter((l) => l.includes('[fps]'));
if (!lines.length) {
  console.log('没读到 [fps] 日志。原始输出片段：');
  console.log(out.split(/\r?\n/).slice(-12).join('\n'));
  process.exit(1);
}
for (const l of lines) console.log('  ' + l.replace(/^.*\[fps\]/, '[fps]').trim());
