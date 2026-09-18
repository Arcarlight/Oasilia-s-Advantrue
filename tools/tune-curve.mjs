// 难度曲线调参：让「玩家胜率」随章节**平滑下降**，而不是忽高忽低。
//
// 做法：对每个（档位 × 章节）二分搜索敌人 HP，使实测胜率逼近目标曲线。
// 同一批种子 + 同一副牌组，所以探针之间可比；只改 HP，ATK 表保持原样（它本来就是平滑递增的）。
//
// 用法:
//   node tools/tune-curve.mjs              # 只测量并打印建议表（不写文件）
//   node tools/tune-curve.mjs --write      # 写进 src/data/balance.js
//   node tools/tune-curve.mjs --write 80   # 每个探针 80 场（默认 110）
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promises as fs } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem: () => null, setItem: () => {}, removeItem: () => {} };

const WRITE = process.argv.includes('--write');
const N = Number(process.argv.filter((a) => /^\d+$/.test(a))[0] ?? 110);

const { Game } = await imp('src/core/game.js');
const { BALANCE } = await imp('src/data/balance.js');
const { STARTER_DECK } = await imp('src/data/cards.js');

/**
 * 目标胜率曲线（贪婪 AI、不喝药、不用道具的「下限表现」）。
 * 逐章平滑下降，最难的最后一章精英也有 55%（不把玩家吊着打）。
 */
const TARGET = {
  mob:    [1.00, 0.99, 0.98, 0.97, 0.96, 0.95],
  normal: [0.98, 0.96, 0.94, 0.91, 0.88, 0.85],
  elite:  [0.85, 0.79, 0.73, 0.67, 0.61, 0.55],
  boss:   [0.90, 0.86, 0.82, 0.78, 0.74, 0.70],
};

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

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/**
 * 造一副「像真玩家会有的牌」：**起始卡组 + 战斗奖励里拿到的牌**。
 *
 * 以前这里是「整副牌都从奖励池里抽」—— 那等于假设玩家每一张都是龙爪/地震/超级冲击，
 * 牌组比真实情况强一大截，于是调出来的难度**偏难**，
 * 和 measure-balance（从起始卡组开始长）量出来的胜率能差 20 个百分点。
 * 现在两边用同一个牌组模型，两套工具的结论才能互相印证。
 */
function buildDeck(rng, size) {
  const out = STARTER_DECK.slice(0, size);
  while (out.length < size) out.push(rng() < 0.75 ? ATTACK[Math.floor(rng() * ATTACK.length)] : UTIL[Math.floor(rng() * UTIL.length)]);
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

/** 打 runs 场，返回玩家胜率（牌组与种子固定，方便比较不同 HP） */
function winRate(stage, kind, runs) {
  let wins = 0;
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
  }
  return wins / runs;
}

const STAGES = BALANCE.enemyHp.mob.length;
const pad = (s, n) => String(s).padEnd(n);
console.log(`难度曲线调参（每档每章 ${N} 场，同一批种子/牌组）`);
console.log(pad('档位', 8) + pad('章节', 6) + pad('目标', 8) + pad('旧HP', 8) + pad('旧胜率', 9) + pad('新HP', 8) + '新胜率');

const next = {};
for (const tier of ['mob', 'normal', 'elite', 'boss']) {
  next[tier] = [...BALANCE.enemyHp[tier]];
  for (let stage = 0; stage < STAGES; stage++) {
    const kind = tier === 'mob' || tier === 'normal' ? 'normal' : tier;
    const target = TARGET[tier][stage] ?? TARGET[tier].at(-1);
    const oldHp = BALANCE.enemyHp[tier][stage];
    BALANCE.enemyHp[tier][stage] = oldHp;
    const oldRate = winRate(stage, kind, N);
    // 二分：胜率对 HP 单调下降。先确认区间，再收敛。
    let lo = Math.max(40, Math.round(oldHp * 0.35));
    let hi = Math.round(oldHp * 2.6);
    let bestHp = oldHp, bestRate = oldRate, probes = 0;
    for (let it = 0; it < 7; it++) {
      const mid = Math.round((lo + hi) / 2);
      BALANCE.enemyHp[tier][stage] = mid;
      const rate = winRate(stage, kind, N);
      probes++;
      if (Math.abs(rate - target) < Math.abs(bestRate - target)) { bestHp = mid; bestRate = rate; }
      if (Math.abs(rate - target) <= 0.02) { bestHp = mid; bestRate = rate; break; }
      if (rate > target) lo = mid + 1; else hi = mid - 1;   // 胜率太高 → 加血
      if (lo > hi) break;
    }
    BALANCE.enemyHp[tier][stage] = bestHp;
    next[tier][stage] = bestHp;
    console.log(
      pad(tier, 8) + pad('第' + (stage + 1) + '章', 6) +
      pad((target * 100).toFixed(0) + '%', 8) + pad(oldHp, 8) +
      pad((oldRate * 100).toFixed(1) + '%', 9) + pad(bestHp, 8) + (bestRate * 100).toFixed(1) + '%'
    );
    // 复原，避免影响下一档的测量（敌人池不同，但保持干净）
    BALANCE.enemyHp[tier][stage] = bestHp;
  }
}

console.log('\n新的 enemyHp 表：');
for (const tier of ['mob', 'normal', 'elite', 'boss']) console.log(`    ${tier}: [${next[tier].join(', ')}],`);

// 单调下限：check-content 要求「章节越深敌人 HP 越高」，而二分搜索是按胜率独立调的，
// 有可能出现第 6 章需要的 HP 反而比第 5 章低（池子里换了更强的敌人时就会这样）。
// 所以最后统一抬一遍：后面每一章至少是前一章的 1.03 倍。
for (const tier of ['mob', 'normal', 'elite', 'boss']) {
  for (let i = 1; i < next[tier].length; i++) {
    const floor = Math.round(next[tier][i - 1] * 1.03);
    if (next[tier][i] < floor) next[tier][i] = floor;
  }
}
console.log('\n应用单调下限（每章至少是上一章的 1.03 倍）后：');
for (const tier of ['mob', 'normal', 'elite', 'boss']) console.log(`    ${tier}: [${next[tier].join(', ')}],`);

if (WRITE) {
  const file = path.join(ROOT, 'src', 'data', 'balance.js');
  let text = await fs.readFile(file, 'utf8');
  for (const tier of ['mob', 'normal', 'elite', 'boss']) {
    const re = new RegExp(`(${tier}: \\[)[^\\]]*(\\],)`);
    if (!re.test(text)) { console.error(`✗ 没找到 ${tier} 那一行，没写文件`); process.exit(1); }
    text = text.replace(re, `$1${next[tier].join(', ')}$2`);
  }
  await fs.writeFile(file, text, 'utf8');
  console.log('\n已写入 src/data/balance.js');
} else {
  console.log('\n（没有写文件；加 --write 才会写进 src/data/balance.js）');
}
