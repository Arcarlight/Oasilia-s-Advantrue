// 用 Edge headless 截图 + 收集控制台错误，验证游戏在真实浏览器里跑得起来。
// 用法: node tools/shot.mjs [url] [outfile] [waitMs]
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(async () => true);

const URL_ = process.argv[2] ?? 'http://127.0.0.1:5123/';
// 必须是绝对路径：Edge 的 --screenshot 传相对路径时是按**它自己的 CWD** 解析的，
// 结果什么都不写、退出码还是 0（静默失败，踩过一次），所以这里统一转成绝对路径。
const OUT = path.resolve(ROOT, process.argv[3] ?? path.join('tools', 'shots', 'shot.png'));
const WAIT = Number(process.argv[4] ?? 6000);
// 第五个参数写 motion=1 就不强制「降低动效」：默认强制是为了拿到稳定态截图，
// 但要拍「动画进行中」的一帧（抽牌滑入、销毁碎裂）就得让它真的动起来。
// 第五 / 第六个参数里凡是写成 `宽,高` 的（例如 1180,620）都当窗口尺寸用 ——
// 出牌卡面尺寸是按可用空白算的，窄窗口 / 矮窗口是另一套布局，得能拍到。
const rest = process.argv.slice(5).filter(Boolean);
const ALLOW_MOTION = rest.includes('motion=1');
const SIZE = rest.find((a) => /^\d+,\d+$/.test(a)) ?? '1440,900';
// 这台机器直连 github.com / *.github.io 是不通的（要走本地代理）。
// 想拍线上站点就设 SHOT_PROXY，例如：$env:SHOT_PROXY="127.0.0.1:7897"
const PROXY = process.env.SHOT_PROXY ? process.env.SHOT_PROXY.replace(/^https?:\/\//, '') : '';

await fs.mkdir(path.dirname(OUT), { recursive: true });

const args = [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=' + SIZE,
  '--virtual-time-budget=' + WAIT,
  '--screenshot=' + OUT,
  '--enable-logging=stderr',
  '--v=0',
  '--no-first-run',
  '--no-default-browser-check',
  // 默认关闭入场动画，让截图拿到「稳定态」；要拍动画中间帧时传 motion=1
  ...(ALLOW_MOTION ? [] : ['--force-prefers-reduced-motion']),
  ...(PROXY ? [`--proxy-server=http://${PROXY}`] : []),
  '--user-data-dir=' + path.join(ROOT, 'tools', '.edge-profile'),
  URL_,
];

const child = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
let err = '';
child.stderr.on('data', (d) => { err += d.toString(); });
child.stdout.on('data', (d) => { err += d.toString(); });

const code = await new Promise((res) => child.on('close', res));
const stat = await fs.stat(OUT).catch(() => null);
console.log(`exit=${code}  截图=${path.relative(ROOT, OUT)}${stat ? `（${Math.round(stat.size / 1024)} KB）` : '  ✗ 没有生成文件！'}`);
if (!stat) process.exitCode = 1;
const lines = err.split(/\r?\n/).filter((l) => /CONSOLE|Uncaught|SyntaxError|TypeError|ReferenceError|Failed to load|404/i.test(l));
if (lines.length) {
  console.log('--- 浏览器日志 ---');
  for (const l of lines.slice(0, 60)) console.log('  ' + l.slice(0, 400));
} else {
  console.log('（没有发现错误日志）');
}
