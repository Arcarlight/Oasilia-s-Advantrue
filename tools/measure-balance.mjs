// 用同一套测量方法（autotune 的 evaluate）检查「当前写进 balance.js 的真实数值」。
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

const { Game } = await imp('src/core/game.js');
const { BALANCE } = await imp('src/data/balance.js');
const { STARTER_DECK, rollCard } = await imp('src/data/cards.js');
const { STAGE_BIOME } = await imp('src/data/balance.js');

const RUNS = Number(process.argv[2] ?? 300);
/** `--biome=<key>`：只量某一张地图（新加的替补场景用它单独量） */
const BIOME_ARG = (process.argv.slice(2).find((a) => a.startsWith('--biome=')) ?? '').split('=')[1] || null;
// 各章开始时的「玩家画像」：按每章 +9 攻击 / +6 防御 / +45 生命 / +2.5 敏捷 的成长速度外推
const GROWTH = [
  { atk: 12, def: 12, maxHp: 200, agi: 10, luck: 5, deck: 10 },
  { atk: 22, def: 19, maxHp: 270, agi: 15, luck: 9, deck: 16 },
  { atk: 32, def: 27, maxHp: 330, agi: 19, luck: 12, deck: 21 },
  { atk: 42, def: 33, maxHp: 380, agi: 22, luck: 14, deck: 26 },
  { atk: 50, def: 39, maxHp: 430, agi: 24, luck: 16, deck: 30 },
  { atk: 57, def: 44, maxHp: 470, agi: 24, luck: 18, deck: 34 },
];
/**
 * 牌组模型：**起始卡组 + 一路拿到的奖励牌**，按真实稀有度权重抽（rollCard）。
 *
 * 必须和 tools/derive-enemy-curve.mjs 用同一套。以前这里是「75% 从一张固定强牌表里抽、
 * 25% 从辅助表里抽」，等于假设玩家每一张都是龙爪 / 地震 / 超级冲击，
 * 牌组比真实情况强一大截 —— 于是「调难度」的工具和「验收难度」的工具对同一张表
 * 能给出相差几十个百分点的胜率（实测第 1 章精英：11% vs 73%），
 * 谁也不知道该信哪个。现在两边都是「起始卡组 + 按稀有度抽到的奖励」。
 */
function buildDeck(size) {
  const out = STARTER_DECK.slice(0, size);
  let guard = 0;
  while (out.length < size && guard++ < 200) out.push(rollCard(0.12, []).id);
  return out;
}

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

function measure(stage, kind, runs, biomeOverride = null) {
  let wins = 0, turns = 0, hpPct = 0;
  const byName = new Map();
  for (let i = 0; i < runs; i++) {
    const game = new Game({ seed: 7000 + stage * 613 + i * 37 + kind.length * 11 });
    game.newRun();
    const g = GROWTH[stage];
    Object.assign(game.data, { atk: g.atk, def: g.def, maxHp: g.maxHp, hp: g.maxHp, agi: g.agi, luck: g.luck, stage });
    game.data.deck = buildDeck(g.deck);
    // 地图是 newRun() 按第 1 章生成的：直接改 stage 不会换地图，
    // 于是「第 6 章」一直在打沙漠的怪。这里把 biome 一起改掉。
    // `--biome=<key>` 可以强制某张地图 —— 新加的替补场景（水晶洞窟等）用它单独量。
    game.data.map.biome = biomeOverride ?? STAGE_BIOME[Math.min(STAGE_BIOME.length - 1, stage)];
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
console.log(`当前 balance.js 数值下的实测（${RUNS} 场/档）${BIOME_ARG ? ` · 只量地图 ${BIOME_ARG}` : ''}：`);
console.log(pad('章节', 6) + pad('档位', 8) + pad('胜率', 9) + pad('回合', 7) + pad('剩余HP', 8) + '敌人HP / 敌攻');
const STAGES = BALANCE.enemyHp.mob.length;
for (let stage = 0; stage < STAGES; stage++) {
  for (const tier of ['mob', 'normal', 'elite', 'boss']) {
    const kind = tier === 'mob' || tier === 'normal' ? 'normal' : tier;
    const r = measure(stage, kind, RUNS, BIOME_ARG);
    console.log(
      pad('第' + (stage + 1) + '章', 6) + pad(tier, 8) + pad((r.winRate * 100).toFixed(1) + '%', 9) +
      pad(r.turns.toFixed(1), 7) + pad((r.hpPct * 100).toFixed(0) + '%', 8) +
      `${BALANCE.enemyHp[tier][stage]} / ${BALANCE.enemyAtk[tier][stage]}`,
    );
  }
}
