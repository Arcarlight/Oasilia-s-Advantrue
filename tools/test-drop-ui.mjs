// 门禁：**掉落道具那一屏**在真浏览器里点一遍（`?dgitemdrop=1`）。
//
// 为什么要有这一条：玩家报的两件事都只在这块界面上出现，而它们都不是「数据错」——
//   ① 「不要的选项太浅了，几乎看不见」：`.btn-ghost` 的颜色是给深色背景调的，
//      压在浅色羊皮纸面板上对比度只有 1.15:1（WCAG 正文要求 4.5:1）；
//   ② 「选择丢弃身上道具并收下后，道具已经进入背包，窗口却没有关闭」：
//      换手那一步以前是界面自己拼的（dropItem 内部会重画一次，那一下又弹出同一个丢弃框），
//      结果关掉的是原来那个、新弹的留在屏幕上 —— 玩家看到的就是「窗口没关」，
//      而且再点一次就能把同一件掉落再收一遍。
//
// 回归测试（tools/test-items.mjs）测不到界面，所以这里起一次无头浏览器，
// 把 tests/diag-itemdrop.js 的断言跑一遍，**任何一条 ✗ 都算门禁失败**。
//
// 前置：本地 dev server 在 5123（和 tools/smoke-check.mjs 一样）。
// 用法：node tools/test-drop-ui.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL_ = 'http://127.0.0.1:5123/?dgitemdrop=1';
const profile = mkdtempSync(join(tmpdir(), 'edge-drop-'));

const child = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--window-size=1440,900',
  '--enable-logging=stderr',
  '--v=0',
  '--no-first-run',
  '--no-default-browser-check',
  '--mute-audio',
  `--user-data-dir=${profile}`,
  URL_,
], { stdio: ['ignore', 'pipe', 'pipe'] });

let buf = '';
const done = new Promise((resolve) => {
  const killTimer = setTimeout(() => { child.kill(); resolve('timeout'); }, 90000);
  const onData = (d) => {
    buf += d.toString('utf8');
    if (/DROP_DONE/.test(buf)) { clearTimeout(killTimer); setTimeout(() => { child.kill(); resolve('done'); }, 400); }
  };
  child.stderr.on('data', onData);
  child.stdout.on('data', onData);
  child.on('error', () => { clearTimeout(killTimer); resolve('spawn-failed'); });
});

const how = await done;
try { rmSync(profile, { recursive: true, force: true }); } catch { /* 无所谓 */ }

/** 把 [d2] [drop] 那几行擦干净（Edge 的日志前缀很长） */
const lines = buf.split(/\r?\n/)
  .filter((l) => l.includes('[d2] [drop]'))
  .map((l) => l.replace(/^.*?\[drop\]\s*/, '').replace(/",\s*source:.*$/, '').replace(/"\s*$/, '').trim())
  .filter(Boolean);

for (const l of lines) console.log('  ' + l);

const bad = lines.filter((l) => l.startsWith('✗'));
const fatal = lines.find((l) => l.startsWith('DROP_FATAL'));
const errored = lines.find((l) => l.startsWith('DROP_ERRORS='));
const passed = lines.filter((l) => l.startsWith('✓')).length;

console.log(`\n掉落窗口界面测试：通过 ${passed}，失败 ${bad.length}${how === 'timeout' ? '（浏览器超时，检查 dev server 是不是在 5123 上）' : ''}`);
if (fatal) console.log('FATAL: ' + fatal);
if (errored) console.log(errored);

if (bad.length || fatal || errored || how !== 'done' || !passed) {
  if (!lines.length) {
    console.log('❌ 一条断言都没跑到 —— 多半是本地 dev server 没起：');
    console.log('   node tools/serve.mjs --no-open     # 然后重跑本脚本');
  }
  console.log(`\n❌ 掉落窗口界面测试未通过（失败 ${bad.length} 条）。`);
  process.exitCode = 1;
} else {
  console.log('\n✅ 掉落窗口界面测试全绿（「不要」看得见 + 换手之后窗口会关掉 + 同一件不会被收两次）。');
}
