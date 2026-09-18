// 验证单文件构建：用 file:// 打开 oasis-game.html，自动打一场战斗并遍历所有界面。
// 用法: node tools/verify-bundle.mjs
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FILE_URL = 'file:///' + path.join(ROOT, 'verify-bundle.html').replace(/\\/g, '/');

// 复制一份 bundle 作为验证用（文件名换成 verify-bundle.html），并在末尾注入验证脚本
const bundle = await fs.readFile(path.join(ROOT, 'oasis-game.html'), 'utf8');
const probe = `
<script>
setTimeout(async () => {
  const log = (...a) => console.log('[verify]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const errors = [];
  window.addEventListener('error', (e) => errors.push('window: ' + e.message));
  window.addEventListener('unhandledrejection', (e) => errors.push('promise: ' + (e.reason?.message ?? e.reason)));

  try {
    const g = window.__oasis;
    const ui = window.__oasisUI;
    if (!g || !ui) { log('FATAL 游戏没启动'); return; }

    log('标题按钮数 =', document.querySelectorAll('.title-menu .btn').length);
    log('精灵元数据 =', !!window.__OASIS_SPRITE_META__, '，内联精灵图 =', Object.keys(window.__OASIS_SPRITES__ || {}).length);

    g.newRun(777);
    await wait(400);
    log('newRun -> phase', g.phase, '，地图节点数', g.data.map.nodes.length, '，DOM 上节点数', document.querySelectorAll('.map-node').length);

    // 挑一个战斗节点
    const node = g.availableNodes().find((n) => n.type === 'battle') ?? g.availableNodes()[0];
    g.goToNode(node.id);
    await wait(900);
    log('进入节点 -> phase', g.phase, '，手牌 DOM', document.querySelectorAll('.hand .card').length,
        '，玩家精灵 canvas', document.querySelectorAll('.fighter-body canvas').length,
        '，敌人名称', g.battle?.enemy?.name);

    // 打完这场
    let guard = 0;
    while (g.battle && !g.battle.over && guard++ < 60) {
      if (g.battle.active === 'player') {
        const hand = g.battle.hand('player').filter((c) => g.battle.canPlay(c.uid));
        if (hand.length) g.battle.playCard(hand[0].uid); else g.battle.endTurn();
      } else g.battle.endTurn();
      g.battle.takeEvents();
      await wait(25);
    }
    log('战斗结束 winner =', g.battle.winner, '，回合', g.battle.turn);
    g.finishBattle();
    await wait(400);
    if (g.phase === 'reward') { g.takeRewardCard(g.reward.cardChoices?.[0]?.id ?? null); await wait(400); }
    log('战斗后 phase =', g.phase, '，HP', g.data.hp + '/' + g.data.maxHp);

    // 所有界面都渲染一遍
    for (const s of ['event','chest','shop','rest','reward','gameover','victory','map','boss']) {
      try {
        const r = window.__oasisAuto({ scene: s });
        await wait(220);
        log('界面', s, '->', r, '，屏幕元素', document.querySelectorAll('.screen').length);
      } catch (e) { errors.push(s + ': ' + e.message); }
    }

    // 检查精灵图真的画出来了（canvas 不是全透明）
    window.__oasisAuto({ scene: 'battle' });
    await wait(1200);
    const canvases = [...document.querySelectorAll('.fighter-body canvas')];
    let painted = 0;
    for (const c of canvases) {
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let opaque = 0;
      for (let i = 3; i < d.length; i += 400) if (d[i] > 10) opaque++;
      if (opaque > 0) painted++;
    }
    log('画布已绘制精灵的数量 =', painted, '/', canvases.length);

    log('ERRORS=' + JSON.stringify(errors));
    log('VERIFY_OK');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
  }
}, 800);
</script>`;

await fs.writeFile(path.join(ROOT, 'verify-bundle.html'), bundle.replace('</body>', probe + '\n</body>'), 'utf8');

const args = [
  '--headless=new', '--disable-gpu', '--window-size=1440,900',
  '--virtual-time-budget=40000', '--enable-logging=stderr', '--v=0',
  '--no-first-run', '--no-default-browser-check',
  '--allow-file-access-from-files',
  '--user-data-dir=' + path.join(ROOT, 'tools', '.edge-profile-verify'),
  FILE_URL,
];
const child = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
child.stderr.on('data', (d) => { out += d.toString(); });
child.stdout.on('data', (d) => { out += d.toString(); });
const code = await new Promise((r) => child.on('close', r));

const lines = out.split(/\r?\n/).filter((l) => /\[verify\]|Uncaught|TypeError|ReferenceError|SyntaxError/.test(l));
console.log(`exit=${code}`);
for (const l of lines) console.log('  ' + l.replace(/^.*INFO:CONSOLE:\d+\]\s*/, '').slice(0, 260));
if (!lines.some((l) => l.includes('VERIFY_OK'))) console.log('\n（未出现 VERIFY_OK）');

await fs.rm(path.join(ROOT, 'verify-bundle.html'), { force: true });
