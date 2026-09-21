// 诊断：战斗界面底部那条「下回合最多约 N 伤害」**准不准**。
//
// 起因（用户报的）：「现在战斗界面下方显示敌人最多造成多少伤害的条也非常不准」。
//
// 这条提示是 `Battle.predictEnemyThreat()` 算的：它拿「手牌 + 牌堆前 N 张」按评分贪心地
// 摆一摆，估一个上界。敌人实际出牌走的是 `enemyAct()`（精英 / 首领还会先跑
// `planEnemyTurn()` 决定要不要先挂强化）——**两套逻辑各写一份，必然对不上**。
//
// 这一份把「预测值」和「敌人这一回合真实打出的伤害」逐回合比对，报：
//   · 平均低估 / 高估多少（百分比）；
//   · 低估最狠的那几回合（对手牌名 + 预测 + 实际）；
//   · 同一个 AI 顺序不一致造成的差距（预测按评分选牌，实际执行也按评分 —— 但强化链不一样）。
//
// 用法: node tools/probe-threat.mjs [章节] [档位] [场数] [hero]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { Game } = await imp('src/core/game.js');
const { STAGE_BIOME } = await imp('src/data/balance.js');
const { STARTER_DECK, rollCard } = await imp('src/data/cards.js');

const stage = Number(process.argv[2] ?? 5);
const tier = process.argv[3] ?? 'elite';
const runs = Number(process.argv[4] ?? 120);
const HERO = process.argv[5] && !process.argv[5].startsWith('--') ? process.argv[5] : null;

const GROWTH = [
  { atk: 12, def: 12, maxHp: 200, agi: 10, luck: 5, deck: 10 },
  { atk: 22, def: 19, maxHp: 270, agi: 15, luck: 9, deck: 16 },
  { atk: 32, def: 27, maxHp: 330, agi: 19, luck: 12, deck: 21 },
  { atk: 42, def: 33, maxHp: 380, agi: 22, luck: 14, deck: 26 },
  { atk: 50, def: 39, maxHp: 430, agi: 24, luck: 16, deck: 30 },
  { atk: 57, def: 44, maxHp: 470, agi: 24, luck: 18, deck: 34 },
][stage];

function autoPlay(b) {
  let g = 0;
  while (!b.over && g++ < 24) {
    const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
    if (!hand.length) break;
    const best = hand.map((c) => ({ c, s: b.scoreCard('player', c.card) })).sort((a, x) => x.s - a.s)[0];
    if (best.s <= 0) break;
    if (!b.playCard(best.c.uid).ok) break;
    b.takeEvents();
  }
}

const rows = [];
let guard = 0;
for (let i = 0; guard < runs * 12 && rows.length < runs * 4; i += 1) {
  guard += 1;
  const game = new Game({ seed: 910000 + i * 41 });
  game.newRun(undefined, HERO ? { hero: HERO } : {});
  Object.assign(game.data, { ...GROWTH, hp: GROWTH.maxHp, stage });
  game.data.map.biome = STAGE_BIOME[stage];
  game.data.deck = [...STARTER_DECK, ...Array.from({ length: GROWTH.deck - STARTER_DECK.length }, () => rollCard(0.12, [], null, game.data.hero).id)];
  game.data.battleDeck = null;
  game.startBattle(tier === 'boss' ? 'boss' : tier === 'elite' ? 'elite' : 'normal', 4);
  const b = game.battle;
  if (b.enemy.tier !== tier) continue;
  let t = 0;
  while (!b.over && t < 8) {
    if (b.active === 'player') { t += 1; autoPlay(b); }
    b.takeEvents();
    if (b.over || t >= 8) break;
    // 玩家一结束回合，界面上那条提示就是此刻算出来的
    const predict = b.predictEnemyThreat();
    let real = 0;
    let topReal = 0; let topName = null; let cur = null;
    b.endTurn();
    for (const ev of b.takeEvents()) {
      if (ev.type === 'playCard' && ev.side === 'enemy') cur = ev.name ?? ev.id;
      if ((ev.type === 'damage' || ev.type === 'trueDamage') && ev.side === 'player') {
        real += ev.amount;
        if (cur && ev.amount > topReal) { topReal = ev.amount; topName = cur; }
      }
    }
    rows.push({ predict: predict.damage, expected: predict.expected, real, topName, topPredict: predict.topName, turn: t, enemy: b.enemy.name });
  }
}

const withReal = rows.filter((r) => r.real > 0 || r.predict > 0);
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
/**
 * ⚠ 「实际」= 玩家侧收到的伤害事件之和：**被护盾吃掉的部分、被闪掉的那一下都不在里面**，
 * 所以会出现「预计 300 → 实际 13」这种（那一回合玩家顶着一面大盾）。
 * 看准确度请以中位数为准，别盯极值。
 */
console.log(`第 ${stage + 1} 章 ${tier}（主角 ${HERO ?? 'oasilia'}）：比对 ${withReal.length} 个回合`);
for (const [key, label] of [['expected', '预计（界面主显）'], ['predict', '最多（上界）']]) {
  const rs = withReal.filter((x) => x[key] > 0).map((x) => x.real / x[key]);
  const sortedR = [...rs].sort((a, b) => a - b);
  const u = withReal.filter((x) => x.real > x[key] * 1.15).length;
  const o = withReal.filter((x) => x.real < x[key] * 0.85).length;
  console.log(`  ${label}：预测 / 实际 中位 ${median(rs).toFixed(2)} · 平均 ${avg(rs).toFixed(2)} · p10 ${sortedR[Math.floor(sortedR.length * 0.1)]?.toFixed(2)} · p90 ${sortedR[Math.floor(sortedR.length * 0.9)]?.toFixed(2)}（低估 ${u} · 高估 ${o} / ${withReal.length}）`);
}
const under = withReal.filter((r) => r.real > r.expected * 1.15);
console.log('  低估最狠的 8 个回合（对着「预计」比）：');
for (const r of under.slice().sort((a, b) => (b.real - b.expected) - (a.real - a.expected)).slice(0, 8)) {
  console.log(`    ${String(r.enemy).padEnd(8)} 预计 ${String(Math.round(r.expected)).padStart(4)} / 最多 ${String(Math.round(r.predict)).padStart(4)} → 实际 ${String(r.real).padStart(4)}（最狠的一下：${r.topName ?? '—'}）`);
}
console.log('  高估最狠的 5 个回合（对着「预计」比）：');
for (const r of withReal.filter((x) => x.real < x.expected * 0.85).slice().sort((a, b) => (a.real - a.expected) - (b.real - b.expected)).slice(0, 5)) {
  console.log(`    ${String(r.enemy).padEnd(8)} 预计 ${String(Math.round(r.expected)).padStart(4)} / 最多 ${String(Math.round(r.predict)).padStart(4)} → 实际 ${String(r.real).padStart(4)}`);
}
