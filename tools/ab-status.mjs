// 状态层数 A/B：把「剧毒 / 火焰牙 / 热风」的中毒·灼伤层数在两组之间来回切换，
// 用**同一颗种子 + 同一副随机卡组**跑同一场战斗，从而把这个改动的影响单独量出来。
//
// 为什么不用 measure-balance 前后各跑一次来对比：
// 那个测量每场都靠 Math.random() 现拼卡组，80 场/档的噪声就有 ±6 个百分点
// （同一份代码连跑两次，第 6 章精英一次 71.3%、一次 82.5%），
// 而这次改动只有「每回合多掉 1~2 点真伤」，完全淹没在噪声里。
//
// 用法：node tools/ab-status.mjs [每档场次]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const { Game } = await imp('src/core/game.js');
const { CARD_BY_ID } = await imp('src/data/cards.js');

const RUNS = Number(process.argv[2] ?? 200);

/** A = 文案没改之前的效果（1/1/1 层）；B = 照文案补齐（3/2/3 层） */
const A = { toxic: 1, fire_fang: 1, heat_wave: 1 };
const B = { toxic: 3, fire_fang: 2, heat_wave: 3 };

function applyStacks(map) {
  for (const [id, n] of Object.entries(map)) {
    const card = CARD_BY_ID[id];
    if (!card) continue;
    for (const e of card.effects) if (e.kind === 'status') e.stacks = n;
  }
}

const GROWTH = [
  { atk: 12, def: 12, maxHp: 200, agi: 10, luck: 5, deck: 10 },
  { atk: 22, def: 19, maxHp: 270, agi: 15, luck: 9, deck: 16 },
  { atk: 32, def: 27, maxHp: 330, agi: 19, luck: 12, deck: 21 },
  { atk: 42, def: 33, maxHp: 380, agi: 22, luck: 14, deck: 26 },
  { atk: 50, def: 39, maxHp: 430, agi: 24, luck: 16, deck: 30 },
  { atk: 57, def: 44, maxHp: 470, agi: 24, luck: 18, deck: 34 },
];
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

/** 跑一场：卡组用「同种子固定下来的 Math.random」拼，两次调用的卡组完全一致 */
function fight(stage, kind, seed, stacks) {
  applyStacks(stacks);
  const realRandom = Math.random;
  let s = seed * 2654435761 % 2147483647;
  Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  try {
    const game = new Game({ seed: 9000 + seed * 7 + kind.length });
    game.newRun();
    const g = GROWTH[stage];
    Object.assign(game.data, { atk: g.atk, def: g.def, maxHp: g.maxHp, hp: g.maxHp, agi: g.agi, luck: g.luck, stage });
    while (game.data.deck.length < g.deck) {
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
    return { win: b.winner === 'player', turns: b.turn, hp: Math.max(0, b.player.hp) / b.player.maxHp };
  } finally {
    Math.random = realRandom;
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`状态层数 A/B（每档 ${RUNS} 场，A=旧效果 1/1/1 层，B=照文案 3/2/3 层）：`);
console.log(pad('章节', 7) + pad('档位', 8) + pad('A 胜率', 10) + pad('B 胜率', 10) + pad('差', 8) + 'A/B 回合 · 剩余HP');
const STAGES = GROWTH.length;
const totals = { a: 0, b: 0, n: 0 };
for (let stage = 0; stage < STAGES; stage++) {
  for (const tier of ['mob', 'normal', 'elite', 'boss']) {
    const kind = tier === 'mob' || tier === 'normal' ? 'normal' : tier;
    let wa = 0, wb = 0, ta = 0, tb = 0, ha = 0, hb = 0;
    for (let i = 0; i < RUNS; i++) {
      const seed = 100000 + stage * 7919 + i * 31 + tier.length * 13;
      const ra = fight(stage, kind, seed, A);
      const rb = fight(stage, kind, seed, B);
      if (ra.win) wa++;
      if (rb.win) wb++;
      ta += ra.turns; tb += rb.turns; ha += ra.hp; hb += rb.hp;
    }
    const pa = wa / RUNS, pb = wb / RUNS;
    totals.a += wa; totals.b += wb; totals.n += RUNS;
    console.log(
      pad('第' + (stage + 1) + '章', 7) + pad(tier, 8) +
      pad((pa * 100).toFixed(1) + '%', 10) + pad((pb * 100).toFixed(1) + '%', 10) +
      pad(((pb - pa) * 100).toFixed(1), 8) +
      `${(ta / RUNS).toFixed(1)}/${(tb / RUNS).toFixed(1)} 回合 · ${(ha / RUNS * 100).toFixed(0)}%/${(hb / RUNS * 100).toFixed(0)}%`,
    );
  }
}
console.log(`合计：A ${(totals.a / totals.n * 100).toFixed(1)}% → B ${(totals.b / totals.n * 100).toFixed(1)}%（差 ${((totals.b - totals.a) / totals.n * 100).toFixed(1)} 个百分点，共 ${totals.n} 对）`);
