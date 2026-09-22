// 门禁：**说明页里的字 vs 引擎实况**（`?dghelp=1`，真浏览器）。
//
// 起因：说明页是玩家唯一的规则手册，而它一直「照着上一版游戏」写 ——
// 实测抓到过：写着「三章都走完就算通关」（实际 6 章）、「营地回复 35%」（实际 30%）、
// 「每场战斗后的 4%」（实际 6%），以及**整栏按旧的道具制写的**：
// 「药水（好伤药 / 厉害伤药）留在背包里…**战斗中随时能用**」——
// 那三件道具早就改名了，而且引擎里战斗中**根本不能**用道具（用户点名定的规则）。
//
// 这些字只有渲染出来才看得见（数字全是运行时拼的），所以只能起浏览器量。
// tools/diag-help.js 里那几十条断言就是判据，这里只负责跑它、把 ✗ 变成退出码。
//
// 前置：本地 dev server 在 5123（和 tools/smoke-check.mjs 一样）。
// 用法：node tools/test-copy-ui.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL_ = 'http://127.0.0.1:5123/?dghelp=1';
const profile = mkdtempSync(join(tmpdir(), 'edge-copy-'));

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
const how = await new Promise((resolve) => {
  const killTimer = setTimeout(() => { child.kill(); resolve('timeout'); }, 90000);
  const onData = (d) => {
    buf += d.toString('utf8');
    if (/HP_DONE/.test(buf)) { clearTimeout(killTimer); setTimeout(() => { child.kill(); resolve('done'); }, 400); }
  };
  child.stderr.on('data', onData);
  child.stdout.on('data', onData);
  child.on('error', () => { clearTimeout(killTimer); resolve('spawn-failed'); });
});

try { rmSync(profile, { recursive: true, force: true }); } catch { /* 无所谓 */ }

const lines = buf.split(/\r?\n/)
  .filter((l) => l.includes('[d2] [hp]'))
  .map((l) => l.replace(/^.*?\[hp\]\s*/, '').replace(/",\s*source:.*$/, '').replace(/"\s*$/, '').trim())
  .filter(Boolean);

for (const l of lines) console.log('  ' + l);

const bad = lines.filter((l) => l.startsWith('✗'));
const fatal = lines.find((l) => l.startsWith('HP_FATAL'));
const errored = lines.find((l) => l.startsWith('HP_ERRORS='));
const passed = lines.filter((l) => l.startsWith('✓')).length;

console.log(`\n说明页文案测试：通过 ${passed}，失败 ${bad.length}${how === 'timeout' ? '（浏览器超时，检查 dev server 是不是在 5123 上）' : ''}`);
if (fatal) console.log('FATAL: ' + fatal);
if (errored) console.log(errored);

if (bad.length || fatal || errored || how !== 'done' || !passed) {
  if (!lines.length) {
    console.log('❌ 一条断言都没跑到 —— 多半是本地 dev server 没起：');
    console.log('   node tools/serve.mjs --no-open     # 然后重跑本脚本');
  }
  console.log(`\n❌ 说明页文案测试未通过（失败 ${bad.length} 条）。`);
  process.exitCode = 1;
} else {
  console.log('\n✅ 说明页文案测试全绿（数字取自 BALANCE / 旧道具名与「战斗中能用」这类说法都没有了）。');
}
