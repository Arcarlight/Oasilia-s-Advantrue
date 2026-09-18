// 诊断：敌人卡组里「削弱玩家」的牌有多密？一场战斗玩家的防御会被压到多低？
// 用法: node tools/measure-debuff.mjs [局数]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

const { Game } = await imp('src/core/game.js');
const { CARDS, CARD_BY_ID } = await imp('src/data/cards.js');
const { ENEMIES, MOVE_POOLS, TIERS } = await imp('src/data/enemies.js');
const { BIOMES, STAGE_BIOME, BALANCE } = await imp('src/data/balance.js');

const RUNS = Number(process.argv[2] ?? 40);

/** 这张牌是不是「削弱对手（=玩家）」的 */
function debuffScore(card) {
  let n = 0;
  for (const e of card.effects ?? []) {
    if (e.kind === 'buff' && e.amount < 0 && e.target === 'enemy') n += -e.amount;   // 敌人打玩家 → target enemy = 玩家
    if (e.kind === 'buff' && e.amount > 0 && e.target === 'enemy') n += 0;
    if (e.kind === 'status') n += (e.stacks ?? 1) * 2;
  }
  return n;
}

console.log('=== 一、招式池里的削弱牌 ===');
for (const [name, pool] of Object.entries(MOVE_POOLS)) {
  const rows = pool.map((id) => ({ id, card: CARD_BY_ID[id], s: debuffScore(CARD_BY_ID[id]) })).filter((r) => r.s > 0);
  const defRows = pool.map((id) => CARD_BY_ID[id]).filter((c) => c.effects?.some((e) => e.kind === 'buff' && e.stat === 'def' && e.amount < 0 && e.target === 'enemy'));
  console.log(`  ${name.padEnd(12)} 共 ${pool.length} 张，其中削弱 ${rows.length} 张；降防御的 ${defRows.length} 张 ${defRows.length ? '→ ' + defRows.map((c) => c.name).join('/') : ''}`);
}

console.log('\n=== 二、卡牌表里「降对手防御」的牌 ===');
const defDown = CARDS.filter((c) => c.effects?.some((e) => e.kind === 'buff' && e.stat === 'def' && e.amount < 0 && e.target === 'enemy'));
for (const c of defDown) {
  const amt = c.effects.filter((e) => e.kind === 'buff' && e.stat === 'def' && e.amount < 0).reduce((s, e) => s + e.amount, 0);
  console.log(`  ${c.name.padEnd(8)} ${c.ap}费 ${c.rarity.padEnd(8)} 防御 ${amt}  ${c.effects.some((e) => e.kind === 'damage') ? '（带伤害）' : ''}`);
}

console.log('\n=== 三、实战里玩家的防御轨迹（打小怪）===');
const G = (stage) => ({
  atk: [12, 22, 32, 42, 50, 57][stage], def: [12, 19, 27, 33, 39, 44][stage],
  maxHp: [200, 270, 330, 380, 430, 470][stage], agi: [10, 15, 19, 22, 24, 24][stage],
  luck: [5, 9, 12, 14, 16, 18][stage], deckSize: [10, 16, 21, 26, 30, 34][stage],
});
const ATTACK = ['bite', 'rock_throw', 'double_kick', 'crunch', 'dragon_breath', 'rock_slide', 'earth_power', 'dragon_claw', 'earthquake', 'superpower', 'dragon_darts', 'fire_fang'];
const UTIL = ['bulk_up', 'iron_defense', 'roost', 'protect', 'dragon_dance', 'sandstorm', 'harden', 'screech'];

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

for (let stage = 0; stage < STAGE_BIOME.length; stage++) {
  const stats = G(stage);
  let minDefMod = 0, minDefShow = 999, turns = 0, wins = 0;
  for (let i = 0; i < RUNS; i++) {
    const game = new Game({ seed: 4242 + stage * 977 + i * 31 });
    game.newRun();
    Object.assign(game.data, { ...stats, hp: stats.maxHp, stage });
    while (game.data.deck.length < stats.deckSize) game.data.deck.push(Math.random() < 0.75 ? ATTACK[i % ATTACK.length] : UTIL[i % UTIL.length]);
    game.data.battleDeck = null;
    game.startBattle('normal', 0);
    const b = game.battle;
    let g2 = 0;
    while (!b.over && g2++ < 60) {
      if (b.active === 'player') autoPlay(b);
      minDefMod = Math.min(minDefMod, b.player.defMod);
      minDefShow = Math.min(minDefShow, b.player.def + b.player.defMod);
      b.endTurn();
      b.takeEvents();
    }
    if (b.winner === 'player') wins++;
    turns += b.turn;
  }
  const b0 = BIOMES[STAGE_BIOME[stage]];
  console.log(`  第${stage + 1}章 ${b0.name.padEnd(6)} 基础防御 ${String(stats.def).padStart(2)} | 一局里 defMod 最低 ${String(minDefMod).padStart(3)}，显示最低 ${String(minDefShow).padStart(3)} | 胜率 ${(wins / RUNS * 100).toFixed(0)}% 平均 ${(turns / RUNS).toFixed(1)} 回合`);
}
