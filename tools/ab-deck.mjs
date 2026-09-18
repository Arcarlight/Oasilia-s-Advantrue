// 卡组规模 A/B：同一颗种子 + 同一副随机卡组，只改「带进战斗的牌」——
//   A = 全部所持卡牌（现在的规则）
//   B = 只带 defaultBattleDeck() 挑出来的那 14 张（以前 measure-balance 实际在量的那副）
// 目的：搞清楚「带全部卡」到底让游戏变简单了还是变难了，以及 README 里那张胜率表
// 量的是哪一种玩家。用法：node tools/ab-deck.mjs [每档场次]
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

const RUNS = Number(process.argv[2] ?? 60);
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

/** mode: 'all' = 全部卡牌；'curated' = defaultBattleDeck() 挑的那批 */
function fight(stage, kind, seed, mode) {
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
    const full = game.data.deck.slice();
    const curated = game.defaultBattleDeck();
    const cards = mode === 'all' ? full : curated;
    // 直接替换 activeBattleDeck()：两种口径在同一副卡组、同一颗种子上比
    game.activeBattleDeck = () => cards;
    game.startBattle(kind, 0);
    const b = game.battle;
    let g2 = 0;
    while (!b.over && g2++ < 200) {
      if (b.active === 'player') autoPlay(b);
      b.endTurn();
      b.takeEvents();
    }
    return {
      win: b.winner === 'player',
      turns: b.turn,
      hp: Math.max(0, b.player.hp) / b.player.maxHp,
      size: cards.length,
      dmgCards: cards.filter((id) => CARD_BY_ID[id]?.effects.some((e) => e.kind === 'damage')).length,
    };
  } finally {
    Math.random = realRandom;
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`卡组规模 A/B（每档 ${RUNS} 对；A=全部卡牌，B=defaultBattleDeck() 挑的那批）`);
console.log(pad('章节', 7) + pad('档位', 8) + pad('A 张数/伤害牌', 15) + pad('B 张数/伤害牌', 15) + pad('A 胜率', 10) + pad('B 胜率', 10) + 'A−B');
for (let stage = 0; stage < GROWTH.length; stage++) {
  for (const tier of ['mob', 'normal', 'elite', 'boss']) {
    const kind = tier === 'mob' || tier === 'normal' ? 'normal' : tier;
    let wa = 0, wb = 0, sa = 0, sb = 0, da = 0, db = 0, ha = 0, hb = 0;
    for (let i = 0; i < RUNS; i++) {
      const seed = 500000 + stage * 7919 + i * 31 + tier.length * 13;
      const ra = fight(stage, kind, seed, 'all');
      const rb = fight(stage, kind, seed, 'curated');
      if (ra.win) wa++;
      if (rb.win) wb++;
      sa += ra.size; sb += rb.size; da += ra.dmgCards; db += rb.dmgCards;
      ha += ra.hp; hb += rb.hp;
    }
    const pa = wa / RUNS, pb = wb / RUNS;
    console.log(
      pad('第' + (stage + 1) + '章', 7) + pad(tier, 8) +
      pad(`${(sa / RUNS).toFixed(1)}/${(da / RUNS).toFixed(1)}`, 15) +
      pad(`${(sb / RUNS).toFixed(1)}/${(db / RUNS).toFixed(1)}`, 15) +
      pad((pa * 100).toFixed(1) + '%', 10) + pad((pb * 100).toFixed(1) + '%', 10) +
      ((pa - pb) * 100).toFixed(1) + `  （剩余HP ${(ha / RUNS * 100).toFixed(0)}% vs ${(hb / RUNS * 100).toFixed(0)}%）`,
    );
  }
}
