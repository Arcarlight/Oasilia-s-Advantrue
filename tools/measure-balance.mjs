// 用同一套测量方法（autotune 的 evaluate）检查「当前写进 balance.js 的真实数值」。
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

const { Game } = await imp('src/core/game.js');
const { BALANCE } = await imp('src/data/balance.js');

const RUNS = Number(process.argv[2] ?? 300);
// 各章开始时的「玩家画像」：按每章 +9 攻击 / +6 防御 / +45 生命 / +2.5 敏捷 的成长速度外推
const GROWTH = [
  { atk: 12, def: 12, maxHp: 200, agi: 10, luck: 5, deck: 10 },
  { atk: 22, def: 19, maxHp: 270, agi: 15, luck: 9, deck: 16 },
  { atk: 32, def: 27, maxHp: 330, agi: 19, luck: 12, deck: 21 },
  { atk: 42, def: 33, maxHp: 380, agi: 22, luck: 14, deck: 26 },
  { atk: 50, def: 39, maxHp: 430, agi: 24, luck: 16, deck: 30 },
  { atk: 57, def: 44, maxHp: 470, agi: 24, luck: 18, deck: 34 },
];
// 真实卡组里一定混着防御/辅助牌，这里按比例混进去，
// 避免「全攻击牌」这种玩家拿不到的理想卡组把难度估低了。
const EXTRA_ATTACK = ['bite', 'rock_throw', 'double_kick', 'crunch', 'dragon_breath', 'rock_slide', 'earth_power', 'dragon_claw', 'earthquake', 'superpower', 'dragon_darts', 'fire_fang'];
const EXTRA_UTIL = ['bulk_up', 'iron_defense', 'roost', 'protect', 'dragon_dance', 'sandstorm', 'harden', 'screech']; 

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

function measure(stage, kind, runs) {
  let wins = 0, turns = 0, hpPct = 0;
  const byName = new Map();
  for (let i = 0; i < runs; i++) {
    const game = new Game({ seed: 7000 + stage * 613 + i * 37 + kind.length * 11 });
    game.newRun();
    const g = GROWTH[stage];
    Object.assign(game.data, { atk: g.atk, def: g.def, maxHp: g.maxHp, hp: g.maxHp, agi: g.agi, luck: g.luck, stage });
    while (game.data.deck.length < g.deck) {
      // 约 3/4 攻击牌 + 1/4 防御辅助牌，贴近真实卡组
      const pool = Math.random() < 0.75 ? EXTRA_ATTACK : EXTRA_UTIL;
      game.data.deck.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    game.data.battleDeck = null;
    game.startBattle(kind, 0);
    const b = game.battle;
    let g2 = 0;
    while (!b.over && g2++ < 200) {
      if (b.active === 'player') autoPlay(b);
      b.endTurn();
      b.takeEvents();
    }
    const win = b.winner === 'player';
    if (win) wins++;
    turns += b.turn;
    hpPct += Math.max(0, b.player.hp) / b.player.maxHp;
    const e = byName.get(b.enemy.name) ?? { n: 0, w: 0, t: 0 };
    e.n++; if (win) e.w++; e.t += b.turn;
    byName.set(b.enemy.name, e);
  }
  return { winRate: wins / runs, turns: turns / runs, hpPct: hpPct / runs, byName };
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`当前 balance.js 数值下的实测（${RUNS} 场/档）：`);
console.log(pad('章节', 6) + pad('档位', 8) + pad('胜率', 9) + pad('回合', 7) + pad('剩余HP', 8) + '敌人HP / 敌攻');
const STAGES = BALANCE.enemyHp.mob.length;
for (let stage = 0; stage < STAGES; stage++) {
  for (const tier of ['mob', 'normal', 'elite', 'boss']) {
    const kind = tier === 'mob' || tier === 'normal' ? 'normal' : tier;
    const r = measure(stage, kind, RUNS);
    console.log(
      pad('第' + (stage + 1) + '章', 6) + pad(tier, 8) + pad((r.winRate * 100).toFixed(1) + '%', 9) +
      pad(r.turns.toFixed(1), 7) + pad((r.hpPct * 100).toFixed(0) + '%', 8) +
      `${BALANCE.enemyHp[tier][stage]} / ${BALANCE.enemyAtk[tier][stage]}`,
    );
  }
}
