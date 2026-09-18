// 用 Edge 无头模式打开 ?dg2=1，抓取 [d2] 诊断输出。
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const url = process.argv[2] || 'http://127.0.0.1:5123/?dg2=1';
const budget = process.argv[3] || '60000';
const size = process.argv[4] || '1440,900';
const profile = mkdtempSync(join(tmpdir(), 'edge-d2-'));
// 音频诊断（?dgbgm=1）不能开虚拟时间：虚拟时间会把 setTimeout 瞬间跑完，而解码和
// 音频时钟走的是真实时间，量出来的 loop / 音源数全是过时的。budget 传 "rt" 即真实时间，
// 由页面打印的 DONE 标记来收尾。
const realtime = String(budget).toLowerCase() === 'rt';

const child = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  `--window-size=${size}`,
  ...(realtime ? [] : [`--virtual-time-budget=${budget}`]),
  '--enable-logging=stderr',
  '--v=0',
  '--no-first-run',
  '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required',
  '--mute-audio',
  `--user-data-dir=${profile}`,
  url,
], { stdio: ['ignore', 'pipe', 'pipe'] });

let buf = '';
const killTimer = setTimeout(() => child.kill(), realtime ? 90000 : Number(budget) + 20000);
child.stderr.on('data', (d) => {
  buf += d.toString('utf8');
  if (realtime && /BGM_DONE|D2_DONE|DIAG_DONE|EV_DONE|REST_DONE|FX_DONE|SHIELD_DONE|INTENT_DONE|DMG_DONE|CARD_DONE|FLOAT_DONE/.test(buf)) {
    setTimeout(() => child.kill(), 400);
  }
});
child.stdout.on('data', (d) => { buf += d.toString('utf8'); });

child.on('error', (e) => { console.error('启动 Edge 失败:', e.message); process.exit(1); });
child.on('exit', () => {
  clearTimeout(killTimer);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  const lines = buf.split(/\r?\n/).filter((l) => l.includes('[d2]'));
  for (const l of lines) {
    let m = l.replace(/^.*?INFO:CONSOLE[^"]*"\s*/i, '');
    m = m.replace(/",\s*source:.*$/, '').replace(/"\s*$/, '');
    console.log(m);
  }
  // 错误堆栈是多行的：把 [d2] 之后的原始文本也吐出来，方便定位
  const raw = buf.split('[d2]').slice(1).map((s) => s.split(/\r?\n/).slice(0, 8).join('\n')).join('\n----\n');
  if (/FATAL|ERRORS=\[/.test(buf)) console.log('--- 原始上下文 ---\n' + raw);
  if (!lines.length) {
    console.log('（没有抓到 [d2] 行）');
    console.log(buf.split(/\r?\n/).filter((l) => /ERROR|CONSOLE/i.test(l)).slice(0, 40).join('\n'));
  }
});
