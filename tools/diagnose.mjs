// 诊断脚本：实际打一场，逐事件记录 HP 变化、血条宽度、头像是否加载。
// 用法: node tools/diagnose.mjs
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const TEST = path.join(ROOT, 'diagnose.html');

await fs.writeFile(TEST, `<!DOCTYPE html>
<html><body><div id="stage"></div>
<script type="module">
import { Game } from '/src/core/game.js';
import { UI } from '/src/ui/ui.js';
import { loadSpriteMeta } from '/src/core/sprites.js';
const log = (...a) => console.log('[dg]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const errors = [];
window.addEventListener('error', (e) => errors.push('window: ' + e.message));
window.addEventListener('unhandledrejection', (e) => errors.push('reject: ' + (e.reason && e.reason.message)));

try {
  await loadSpriteMeta();
  const game = new Game({ seed: 4242 });
  window.__oasis = game;
  const ui = new UI(game);
  window.__oasisUI = ui;
  game.newRun(4242);
  await wait(400);

  // --- 检查 HUD 头像 ---
  const face = document.getElementById('hud-portrait');
  const img = face && face.querySelector('img');
  log('HUD 头像:', img ? ('src=' + img.src.slice(0, 60) + ' natural=' + img.naturalWidth + 'x' + img.naturalHeight + ' complete=' + img.complete) : '没有 img 元素');
  if (!img) log('  hud-portrait innerHTML =', face ? face.innerHTML.slice(0, 120) : 'no node');

  // --- 进战斗 ---
  const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
  game.goToNode(node.id);
  await wait(1200);

  const b = game.battle;
  const bs = ui.battleScreen;
  log('战斗开始: 玩家HP', b.player.hp, '/', b.player.maxHp, ' 敌人', b.enemy.name, b.enemy.hp, '/', b.enemy.maxHp);
  log('battleScreen 存在 =', !!bs);

  // 血条读数函数
  const readBars = () => {
    const pFill = document.querySelector('.fighter-player .bar-hp i');
    const eFill = document.querySelector('.fighter-enemy .bar-hp i');
    return {
      playerWidth: pFill ? pFill.style.width : 'no-node',
      playerText: document.querySelector('.fighter-player .bar-hp b') ? document.querySelector('.fighter-player .bar-hp b').textContent : 'no-node',
      enemyWidth: eFill ? eFill.style.width : 'no-node',
      enemyText: document.querySelector('.fighter-enemy .bar-hp b') ? document.querySelector('.fighter-enemy .bar-hp b').textContent : 'no-node',
    };
  };
  log('开局血条:', JSON.stringify(readBars()));

  // 检查战斗头像
  for (const side of ['player', 'enemy']) {
    const box = document.querySelector(side === 'player' ? '.fighter-player .fighter-face' : '.fighter-enemy .fighter-face');
    const fi = box && box.querySelector('img');
    log(side + ' 战斗头像:', fi ? ('natural=' + fi.naturalWidth + ' complete=' + fi.complete) : '没有 img');
  }

  // --- 打 4 个回合，每步对比引擎数值与 DOM 显示 ---
  let mismatch = 0;
  for (let round = 0; round < 4 && !b.over; round++) {
    let guard = 0;
    while (!b.over && guard++ < 12) {
      const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
      if (!hand.length) break;
      const before = { pHp: b.player.hp, eHp: b.enemy.hp };
      const r = b.playCard(hand[0].uid);
      if (!r.ok) break;
      await wait(160);
      const bars = readBars();
      const domP = bars.playerText.split('/')[0].trim();
      const domE = bars.enemyText.split('/')[0].trim();
      const okP = String(Math.max(0, b.player.hp)) === domP;
      const okE = String(Math.max(0, b.enemy.hp)) === domE;
      if (!okP || !okE) mismatch++;
      log('  出牌', hand[0].card.name.padEnd(6),
          '引擎 p=' + b.player.hp + ' e=' + b.enemy.hp,
          '| DOM p=' + domP + ' e=' + domE,
          (okP && okE ? '' : '  <<< 不一致!'),
          '| 血条宽度 p=' + bars.playerWidth + ' e=' + bars.enemyWidth);
    }
    if (!b.over) { b.endTurn(); await wait(900); }
    log('回合结束: 引擎 p=' + b.player.hp + ' e=' + b.enemy.hp, '| DOM', JSON.stringify(readBars()));
  }

  log('不一致次数 =', mismatch);
  log('最终 winner =', b.winner, '玩家HP =', b.player.hp, '敌HP =', b.enemy.hp);

  // --- 事件页面：模拟点选项，看会不会卡住 ---
  game.phase = 'map';
  ui.forceRerender();
  await wait(300);
  game.startEvent();
  await wait(500);
  const opts = document.querySelectorAll('.scene-screen .option');
  log('事件界面选项数 =', opts.length, ' 标题 =', (document.querySelector('.panel-title') || {}).textContent);
  if (opts.length) {
    opts[0].click();
    await wait(600);
    const stillOptions = document.querySelectorAll('.scene-screen .option').length;
    const resultBox = document.querySelector('.result-box');
    const buttons = [...document.querySelectorAll('.scene-screen button')].map((b2) => b2.textContent.trim().slice(0, 12));
    log('点完选项后: 剩余选项 =', stillOptions, ' result-box =', resultBox ? resultBox.textContent.slice(0, 30) : '无', ' 按钮 =', JSON.stringify(buttons));
    const cont = [...document.querySelectorAll('.scene-screen button')].find((b2) => b2.textContent.includes('继续'));
    if (cont) {
      cont.click();
      await wait(600);
      log('点继续后 phase =', game.phase, ' 屏幕数 =', document.querySelectorAll('.screen').length, ' 地图节点数 =', document.querySelectorAll('.map-node').length);
    } else {
      log('!! 没找到「继续前进」按钮 —— 这就是卡住的原因');
    }
  }
  log('ERRORS=' + JSON.stringify(errors));
  log('DG_DONE');
} catch (e) {
  log('FATAL', e.message, e.stack);
  log('DG_DONE');
}
</script></body></html>`, 'utf8');

const args = [
  '--headless=new', '--disable-gpu', '--window-size=1440,900',
  '--virtual-time-budget=60000', '--enable-logging=stderr', '--v=0',
  '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + path.join(ROOT, 'tools', '.edge-dg'),
  'http://127.0.0.1:5123/diagnose.html',
];
const child = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
child.stderr.on('data', (d) => { out += d.toString(); });
const code = await new Promise((r) => child.on('close', r));

for (const l of out.split(/\r?\n/)) {
  if (/\[dg\]/.test(l)) console.log(l.replace(/^.*INFO:CONSOLE:\d+\]\s*/, '').replace(/^"/, '').replace(/", source.*$/, ''));
}
if (!/DG_DONE/.test(out)) console.log('(没有跑完)');

await fs.rm(TEST, { force: true });
await fs.rm(path.join(ROOT, 'tools', '.edge-dg'), { recursive: true, force: true });
