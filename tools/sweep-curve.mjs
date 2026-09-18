// 难度曲线「两把手」扫描：HP 和 ATK 一起调，看能不能既让胜率落在目标曲线上、
// 又不把杂兵战拖成 6~8 回合的持久战。
//
// 背景：改成「出战卡组 = 全部所持卡牌」之后，玩家每回合的可用牌变多了，
// 老曲线整条失效（4~6 章一度 98~100% 胜率）。tune-curve.mjs 只调 HP，
// 把 HP 抬到 1.5~2 倍才把胜率压回目标 —— 代价是杂兵从 4.5 回合变成 6~8 回合。
// 这个脚本扫几组 (HP 系数, ATK 系数)，把「胜率」和「回合数」一起打出来，
// 让人能在两条约束之间挑一个点。
//
// 用法：node tools/sweep-curve.mjs [每档场次] [候选...]
//   候选格式 hp*atk，例如 1*1.3 0.75*1.3（hp 系数 × 当前表，atk 系数 × 当前表）
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { Game } = await imp('src/core/game.js');
const { BALANCE } = await imp('src/data/balance.js');

const RUNS = Number(process.argv[2] ?? 60);
const CANDS = (process.argv.slice(3).length ? process.argv.slice(3) : ['1*1', '1*1.25', '0.75*1.25', '0.7*1.4'])
  .map((s) => {
    const [hp, atk] = s.split('*').map(Number);
    return { label: s, hp, atk };
  });

const TARGET = {
  mob: [1.00, 0.99, 0.98, 0.97, 0.96, 0.95],
  normal: [0.98, 0.96, 0.94, 0.91, 0.88, 0.85],
  elite: [0.85, 0.79, 0.73, 0.67, 0.61, 0.55],
  boss: [0.90, 0.86, 0.82, 0.78, 0.74, 0.70],
};
const TURN_TARGET = { mob: 4.5, normal: 4.5, elite: 5.5, boss: 5 };   // README 的节奏目标（回合数）

const GROWTH = [
  { atk: 12, def: 12, maxHp: 200, agi: 10, luck: 5, deck: 10 },
  { atk: 22, def: 19, maxHp: 270, agi: 15, luck: 9, deck: 16 },
  { atk: 32, def: 27, maxHp: 330, agi: 19, luck: 12, deck: 21 },
  { atk: 42, def: 33, maxHp: 380, agi: 22, luck: 14, deck: 26 },
  { atk: 50, def: 39, maxHp: 430, agi: 24, luck: 16, deck: 30 },
  { atk: 57, def: 44, maxHp: 470, agi: 24, luck: 18, deck: 34 },
];
const ATTACK = ['bite', 'rock_throw', 'double_kick', 'crunch', 'dragon_breath', 'rock_slide', 'earth_power', 'dragon_claw', 'earthquake', 'superpower', 'dragon_darts', 'fire_fang'];
const UTIL = ['bulk_up', 'iron_defense', 'roost', 'protect', 'dragon_dance', 'sandstorm', 'harden', 'screech'];
const mulberry = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const buildDeck = (rng, size) => { const out = []; while (out.length < size) out.push(rng() < 0.75 ? ATTACK[Math.floor(rng() * ATTACK.length)] : UTIL[Math.floor(rng() * UTIL.length)]); return out; };

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

/** 用固定的牌组与种子打 runs 场，返回胜率与平均回合数 */
function measure(stage, kind, runs) {
  let wins = 0;
  let turns = 0;
  let hpLeft = 0;
  for (let i = 0; i < runs; i++) {
    const game = new Game({ seed: 31000 + stage * 977 + i * 53 });
    game.newRun();
    const g = GROWTH[stage];
    Object.assign(game.data, { atk: g.atk, def: g.def, maxHp: g.maxHp, hp: g.maxHp, agi: g.agi, luck: g.luck, stage });
    game.data.deck = buildDeck(mulberry(777 + i), g.deck);
    game.data.battleDeck = null;
    game.startBattle(kind, 0);
    const b = game.battle;
    let guard = 0;
    while (!b.over && guard++ < 200) {
      if (b.active === 'player') autoPlay(b);
      b.endTurn();
      b.takeEvents();
    }
    if (b.winner === 'player') wins++;
    turns += b.turn;
    hpLeft += Math.max(0, b.player.hp) / b.player.maxHp;
  }
  return { rate: wins / runs, turns: turns / runs, hpLeft: hpLeft / runs };
}

const ORIG_HP = JSON.parse(JSON.stringify(BALANCE.enemyHp));
const ORIG_ATK = JSON.parse(JSON.stringify(BALANCE.enemyAtk));
const STAGES = ORIG_HP.mob.length;
const pad = (s, n) => String(s).padEnd(n);

for (const cand of CANDS) {
  for (const tier of ['mob', 'normal', 'elite', 'boss']) {
    BALANCE.enemyHp[tier] = ORIG_HP[tier].map((v) => Math.max(10, Math.round(v * cand.hp)));
    BALANCE.enemyAtk[tier] = ORIG_ATK[tier].map((v) => Math.max(2, Math.round(v * cand.atk)));
  }
  console.log(`\n===== 候选 HP×${cand.hp} / ATK×${cand.atk} =====`);
  console.log(pad('章节', 7) + pad('档位', 8) + pad('胜率', 9) + pad('目标', 8) + pad('回合', 8) + pad('回合目标', 10) + pad('压力/回合', 10) + '敌HP / 敌攻');
  for (let stage = 0; stage < STAGES; stage++) {
    for (const tier of ['mob', 'normal', 'elite', 'boss']) {
      const kind = tier === 'mob' || tier === 'normal' ? 'normal' : tier;
      const r = measure(stage, kind, RUNS);
      const target = TARGET[tier][stage] ?? 0;
      const turnTarget = TURN_TARGET[tier];
      // 压力 = 每回合被打掉的最大生命百分比（README 的目标区间是 15%~22%）
      const pressure = (1 - r.hpLeft) / Math.max(1, r.turns) * 100;
      const flag = Math.abs(r.rate - target) > 0.08 ? ' ✗胜率' : (r.turns > turnTarget * 1.35 ? ' ✗太长' : '');
      console.log(
        pad('第' + (stage + 1) + '章', 7) + pad(tier, 8) +
        pad((r.rate * 100).toFixed(1) + '%', 9) + pad((target * 100).toFixed(0) + '%', 8) +
        pad(r.turns.toFixed(1), 8) + pad(turnTarget.toFixed(1), 10) +
        pad(pressure.toFixed(0) + '%', 10) +
        `${BALANCE.enemyHp[tier][stage]} / ${BALANCE.enemyAtk[tier][stage]}${flag}`,
      );
    }
  }
}

// 还原（这个脚本只做扫描，不写文件）
for (const tier of ['mob', 'normal', 'elite', 'boss']) {
  BALANCE.enemyHp[tier] = ORIG_HP[tier];
  BALANCE.enemyAtk[tier] = ORIG_ATK[tier];
}
console.log('\n（扫描结束，没有写入任何文件）');
