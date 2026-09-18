// 启动诊断：打开真实页面 ?diag=1，由 tools/diagnose-script.js 执行检查。
// 用法: node tools/diagnose.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const args = [
  '--headless=new', '--disable-gpu', '--window-size=1440,900',
  '--virtual-time-budget=140000', '--enable-logging=stderr', '--v=0',
  '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  '--user-data-dir=' + path.join(ROOT, 'tools', '.edge-dg'),
  'http://127.0.0.1:5123/?diag=1',
];
const child = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
child.stderr.on('data', (d) => { out += d.toString(); });
const code = await new Promise((r) => child.on('close', r));

for (const l of out.split(/\r?\n/)) {
  if (/\[dg\]/.test(l)) {
    console.log(l.replace(/^.*INFO:CONSOLE:\d+\]\s*/, '').replace(/^"/, '').replace(/", source.*$/, ''));
  }
}
if (!/DG_DONE/.test(out)) console.log('(没有跑完)');

const { rm } = await import('node:fs/promises');
await rm(path.join(ROOT, 'tools', '.edge-dg'), { recursive: true, force: true });
