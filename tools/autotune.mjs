// 自动调参：搜索各档敌人的 HP，使「贪心 AI 对战」的胜率落在目标区间。
// 用法: node tools/autotune.mjs [每次评估的场次]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promises as fs } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const { Game } = await imp('src/core/game.js');
const BAL = await imp('src/data/balance.js');
const B = await imp('src/core/battle.js');

const N = Number(process.argv[2] ?? 90);

// 目标胜率（贪心 AI、不喝药、不用道具的「下限表现」）
const TARGET = {
  mob: [0.97, 0.99],
  normal: [0.85, 0.94],
  elite: [0.45, 0.62],
  boss: [0.30, 0.48],
};

const GROWTH = [
  { atk: 12, def: 12, maxHp: 200, agi: 10, luck: 5, deck: 10 },
  { atk: 22, def: 19, maxHp: 270, agi: 15, luck: 9, deck: 16 },
  { atk: 32, def: 27, maxHp: 330, agi: 19, luck: 12, deck: 21 },
];
const EXTRA = ['bite', 'rock_throw', 'double_kick', 'crunch', 'dragon_breath', 'rock_slide', 'earth_power', 'bulk_up', 'iron_defense', 'roast'.replace('roast', 'roost'), 'dragon_claw', 'earthquake', 'superpower', 'dragon_darts', 'fire_fang', 'protect'];

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

function evaluate(stage, kind, hpTable, runs = N) {
  // 用一个临时 Game 实例驱动（不修改源文件，直接改内存里的 BALANCE）
  const backup = JSON.parse(JSON.stringify(BAL.BALANCE.enemyHp));
  for (const t of Object.keys(hpTable)) BAL.BALANCE.enemyHp[t][stage] = hpTable[t];

  let wins = 0, turns = 0, hpPct = 0;
  for (let i = 0; i < runs; i++) {
    const game = new Game({ seed: 7000 + stage * 613 + i * 37 + kind.length * 11 });
    game.newRun();
    const g = GROWTH[stage];
    Object.assign(game.data, { atk: g.atk, def: g.def, maxHp: g.maxHp, hp: g.maxHp, agi: g.agi, luck: g.luck, stage });
    while (game.data.deck.length < g.deck) game.data.deck.push(EXTRA[Math.floor(Math.random() * EXTRA.length)]);
    game.data.battleDeck = null;
    game.startBattle(kind, 0);
    // 定档测试固定用同一档的具体敌人，避免物种随机造成噪声
    const b = game.battle;
    let g2 = 0;
    while (!b.over && g2++ < 200) {
      if (b.active === 'player') autoPlay(b);
      b.endTurn();
      b.takeEvents();
    }
    if (b.winner === 'player') wins++;
    turns += b.turn;
    hpPct += Math.max(0, b.player.hp) / b.player.maxHp;
  }
  for (const t of Object.keys(hpTable)) BAL.BALANCE.enemyHp[t][stage] = backup[t][stage];
  return { winRate: wins / runs, turns: turns / runs, hpPct: hpPct / runs };
}

// 对每一章、每一档做 HP 的二分搜索
const result = { mob: [0, 0, 0], normal: [0, 0, 0], elite: [0, 0, 0], boss: [0, 0, 0] };
console.log(`目标胜率：${Object.entries(TARGET).map(([k, v]) => `${k} ${(v[0] * 100).toFixed(0)}~${(v[1] * 100).toFixed(0)}%`).join('  ')}`);
console.log(`每次评估 ${N} 场\n`);

for (let stage = 0; stage < 3; stage++) {
  for (const tier of ['mob', 'normal', 'elite', 'boss']) {
    let lo = 30, hi = 1400;
    let best = null;
    for (let iter = 0; iter < 8; iter++) {
      const mid = Math.round((lo + hi) / 2);
      const probe = { [tier]: mid };
      const r = evaluate(stage, tier === 'mob' || tier === 'normal' ? 'normal' : tier, { [tier]: mid, ...Object.fromEntries(['mob', 'normal', 'elite', 'boss'].filter((t) => t !== tier).map((t) => [t, BAL.BALANCE.enemyHp[t][stage]])) }, Math.round(N * 0.7));
      const [tlo, thi] = TARGET[tier];
      const ok = r.winRate >= tlo && r.winRate <= thi;
      if (ok) { best = { hp: mid, ...r }; break; }
      if (r.winRate > thi) lo = mid;   // 太简单 → 加血
      else hi = mid;                    // 太难 → 减血
    }
    if (!best) best = { hp: Math.round((lo + hi) / 2), winRate: null, turns: null, hpPct: null };
    result[tier][stage] = best.hp;
    const rate = best.winRate == null ? '（未收敛，取中值）' : `胜率 ${(best.winRate * 100).toFixed(0)}%`;
    console.log(`  第${stage + 1}章 ${tier.padEnd(7)} baseHp → ${String(best.hp).padStart(4)}   ${rate}`);
  }
}

console.log('\n>>> balance.js enemyHp：');
for (const [tier, arr] of Object.entries(result)) console.log(`    ${tier}: [${arr.join(', ')}],`);

// 最终复核
console.log('\n最终复核（每档 200 场）：');
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('章节', 6) + pad('档位', 8) + pad('胜率', 9) + pad('回合', 7) + pad('剩余HP', 9) + '敌人HP');
for (let stage = 0; stage < 3; stage++) {
  for (const tier of ['mob', 'normal', 'elite', 'boss']) {
    for (const t of Object.keys(result)) BAL.BALANCE.enemyHp[t][stage] = result[t][stage];
    const kind = tier === 'mob' || tier === 'normal' ? 'normal' : tier;
    const r = evaluate(stage, kind, Object.fromEntries(Object.entries(result).map(([t, a]) => [t, a[stage]])), 200);
    console.log(pad('第' + (stage + 1) + '章', 6) + pad(tier, 8) + pad((r.winRate * 100).toFixed(1) + '%', 9) + pad(r.turns.toFixed(1), 7) + pad((r.hpPct * 100).toFixed(0) + '%', 9) + result[tier][stage]);
  }
}
