// 敌人战力曲线推导：**每一档各自闭环，对着实测值调**。
//
// 历史（两次翻车，别再走回去）：
//   第一版：对每格二分搜索敌人 HP 让「胜率」命中目标 → 胜率对了，代价全压在血量上，
//          后期怪变成 1800 血的血包，玩家实测「战局被强行拉长」。
//   第二版：先定击杀回合反推血量，再用「每点攻击造成多少伤害」这个代理量解析求攻击力。
//          代理量是在**混合池**上量的（一场普通战斗从「杂兵 + 较强」里随机抽一只），
//          于是平均值是对了，两个子档却差出十万八千里 ——
//          实测第 4 章：杂兵每回合 8.9%、**较强 41.9%（最凶一回合 95%）**，
//          玩家反馈「较强的怪攻击力巨高无比」（大嘴雀 攻 122 / 刺甲贝 攻 127），
//          战斗界面的意图提示直接写「下回合最多 623 伤害，会被打倒」。
//
// 现在：**不对任何代理量做解析求解**，直接测量两个真正想要的东西，用比例控制器一点点拧：
//     血量 ← 实测「获胜局的击杀回合」对 targetTurns
//     攻击 ← 实测「每回合打掉玩家多少血」对 PRESSURE
//   而且每一档只统计**它自己的**战斗（按 b.enemy.tier 过滤），杂兵和较强各调各的 ——
//   混合比例是多少都不影响，两档各自把压力压在同一个目标值上。
//
// 用法:
//   node tools/derive-enemy-curve.mjs            只测量并打印建议表
//   node tools/derive-enemy-curve.mjs --write    写进 src/data/balance.js
//   node tools/derive-enemy-curve.mjs --write 30 每格每档 30 个样本（默认 30）
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promises as fs } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem: () => null, setItem: () => {}, removeItem: () => {} };

const WRITE = process.argv.includes('--write');
const N = Number(process.argv.filter((a) => /^\d+$/.test(a))[0] ?? 30);

const { Game } = await imp('src/core/game.js');
const { BALANCE, STAGE_BIOME } = await imp('src/data/balance.js');
const { STARTER_DECK, rollCard } = await imp('src/data/cards.js');

/** 目标击杀回合 */
const TURNS = BALANCE.targetTurns;
/**
 * 目标「每回合压力」——**只用来定一个基准攻击力**（以「较强」档为准）。
 *
 * 为什么不给每档各定一个压力目标：
 * 实测（把三档攻击力都钉成 50、只量卡组本身，第 6 章）——
 *   杂兵 7.6% / 较强 10.3% / 精英 16.1% / 首领 20.5%
 * 也就是说**卡组质量本身已经是逐档递增的**（招式包分两档 + 专属招式 + 幸运暴击）。
 * 再给每档各求一个攻击力，就会得出「首领需要的攻击力反而更低」——
 * 上一版就是这么冒出「较强 攻 128 / 首领 攻 25」的。
 *
 * 所以现在：**攻击力逐档缓慢递增**（下面那个系数表），档位差异主要由卡组 + 血量承担。
 * 结果：① 玩家看到的攻击力永远 杂兵 < 较强 < 精英 < 首领；
 *      ② 每回合压力自动落成递增的 7% / 11% / 17% / 23%。
 */
const PRESSURE = { normal: 0.11 };
/** 攻击力的档位系数：增幅刻意很小 —— 大头在卡组，不在这个数上 */
const TIER_ATK_MUL = { mob: 0.88, normal: 1.0, elite: 1.06, boss: 1.14 };

/** 各章开始时的玩家画像（和 measure-balance 保持一致，改动要同步） */
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
 * 必须和 measure-balance / tune-curve 用同一套，否则「调难度」和「验收难度」两个工具
 * 会对同一张表给出完全不同的胜率（实测差过几十个百分点）。
 */
function buildDeck(size) {
  const out = STARTER_DECK.slice(0, size);
  let guard = 0;
  while (out.length < size && guard++ < 200) out.push(rollCard(0.12, []).id);
  return out;
}
function autoPlay(b, sink) {
  let g = 0;
  while (!b.over && g++ < 24) {
    const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
    if (!hand.length) break;
    const best = hand.map((c) => ({ c, s: b.scoreCard('player', c.card) })).sort((a, x) => x.s - a.s)[0];
    if (best.s <= 0) break;
    if (!b.playCard(best.c.uid).ok) break;
    for (const ev of b.takeEvents()) sink?.(ev);
  }
}

function makeGame(stage, i) {
  const game = new Game({ seed: 31000 + stage * 977 + i * 53 });
  game.newRun();
  const g = GROWTH[stage];
  Object.assign(game.data, { atk: g.atk, def: g.def, maxHp: g.maxHp, hp: g.maxHp, agi: g.agi, luck: g.luck, stage });
  // 地图是 newRun() 按第 1 章生成的，直接改 stage 不会换地图 ——
  // 不改 biome 的话后面几章会一直在打第 1 章的怪（属性包 / 首领全不对）
  game.data.map.biome = STAGE_BIOME[Math.min(STAGE_BIOME.length - 1, stage)];
  game.data.deck = buildDeck(g.deck);
  game.data.battleDeck = null;
  return game;
}

/**
 * 打若干场，**只统计指定档位**的战斗，返回：
 *   turnsWon  获胜局的平均击杀回合
 *   pressure  每回合打掉玩家最大生命的比例（实测）
 *   rate      胜率
 *   worst     最凶的一回合占玩家最大生命的比例
 *   threat    「下回合最多 N 伤害」预估占玩家最大生命的比例
 */
function probeTier(stage, tier, samples) {
  const kind = tier === 'mob' || tier === 'normal' ? 'normal' : tier;
  const maxHp = GROWTH[stage].maxHp;
  let wins = 0, turnsWon = 0, turns = 0, dmg = 0, worst = 0, threat = 0, n = 0;
  for (let i = 0; i < samples * 8 && n < samples; i++) {
    const game = makeGame(stage, i);
    game.startBattle(kind, 4);      // nodeIndex 4 ≈ 章中段
    const b = game.battle;
    if (b.enemy.tier !== tier) continue;
    n += 1;
    threat += b.predictEnemyThreat().damage;
    let t = 0, runDmg = 0, runWorst = 0;
    const sink = (ev) => {
      if ((ev.type === 'damage' || ev.type === 'trueDamage') && ev.side === 'player') { dmg += ev.amount; runDmg += ev.amount; }
    };
    while (!b.over && t < 8) {
      if (b.active === 'player') { t += 1; autoPlay(b, sink); }
      for (const ev of b.takeEvents()) sink(ev);
      runWorst = Math.max(runWorst, runDmg);
      runDmg = 0;
      if (t >= 8) break;
      b.endTurn();
      for (const ev of b.takeEvents()) sink(ev);
    }
    const win = b.winner === 'player';
    if (win) { wins += 1; turnsWon += b.turn; }
    turns += t;
    worst = Math.max(worst, runWorst);
  }
  return {
    n,
    rate: wins / Math.max(1, n),
    turnsWon: turnsWon / Math.max(1, wins),
    pressure: dmg / Math.max(1, turns) / maxHp,
    worst: worst / maxHp,
    threat: threat / Math.max(1, n) / maxHp,
  };
}

const STAGES = BALANCE.enemyHp.mob.length;
const TIERS = ['mob', 'normal', 'elite', 'boss'];
const pad = (s, n) => String(s).padEnd(n);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pct = (v) => (v * 100).toFixed(0) + '%';

// 从小往大收敛（血量与击杀回合近似成正比，从下面爬比从上面掉稳定得多）
const hp = {}, baseAtk = new Array(STAGES).fill(6);
for (const tier of TIERS) hp[tier] = new Array(STAGES).fill(40);

/** 把状态写进 BALANCE：攻击力 = 该章基准 × 档位系数（系数递增 → 攻击力一定递增） */
function apply() {
  for (const tier of TIERS) {
    for (let s = 0; s < STAGES; s++) {
      BALANCE.enemyHp[tier][s] = Math.max(15, Math.round(hp[tier][s]));
      BALANCE.enemyAtk[tier][s] = Math.max(3, Math.round(baseAtk[s] * TIER_ATK_MUL[tier]));
    }
  }
}

for (let round = 1; round <= 6; round++) {
  console.log(`\n=== 第 ${round} 轮（基准攻击力对准「较强」的压力；血量各自对准击杀回合） ===`);
  console.log(pad('档位', 8) + pad('章节', 7) + pad('HP', 7) + pad('回合', 7) + pad('→目标', 8) +
    pad('ATK', 6) + pad('压力', 8) + pad('最凶回合', 10) + pad('胜率', 8) + '意图上界');
  let worstDev = 0;
  for (let stage = 0; stage < STAGES; stage++) {
    // A. 先把这一章的基准攻击力拧到「较强」档的目标
    apply();
    const rn = probeTier(stage, 'normal', N);
    if (rn.n === 0) { console.log(`第 ${stage + 1} 章：没抽到「较强」样本`); continue; }
    const pRatio = clamp(PRESSURE.normal / Math.max(0.01, rn.pressure), 0.3, 3);
    baseAtk[stage] *= 1 + (pRatio - 1) * 0.7;
    // B. 攻击力定下来之后，每一档各自把血量拧到目标回合
    for (const tier of TIERS) {
      apply();
      const r = probeTier(stage, tier, N);
      if (r.n === 0) continue;
      const tDev = Math.abs((r.turnsWon || 1) - TURNS[tier]) / TURNS[tier];
      worstDev = Math.max(worstDev, tDev);
      console.log(
        pad(tier, 8) + pad('第' + (stage + 1) + '章', 7) + pad(Math.round(hp[tier][stage]), 7) +
        pad((r.turnsWon || 0).toFixed(2), 7) + pad(TURNS[tier].toFixed(1), 8) +
        pad(Math.round(baseAtk[stage] * TIER_ATK_MUL[tier]), 6) + pad(pct(r.pressure), 8) +
        pad(pct(r.worst), 10) + pad(pct(r.rate), 8) + pct(r.threat),
      );
      /**
       * 血量：往击杀回合拧，但**只在打得动的时候**。
       * 踩过的坑：胜率 0% 时 turnsWon 是 0，控制器会读成「打得太快了」，
       * 于是疯狂加血（实测把精英加到 3284、首领加到 8428 —— 而血量本身就会杀人：
       * 打不完 = 一直被揍，于是胜率更低、更疯狂加血）。打不动时正确答案是**减血**。
       */
      if (r.rate >= 0.45) {
        const tRatio = clamp(TURNS[tier] / Math.max(0.4, r.turnsWon || 1), 0.4, 3);
        hp[tier][stage] *= 1 + (tRatio - 1) * 0.7;
      } else {
        hp[tier][stage] *= 0.7;
      }
    }
    console.log(pad('', 8) + pad('', 7) + `　基准攻击力 ${baseAtk[stage].toFixed(1)}（较强档实测 ${pct(rn.pressure)} → 目标 ${pct(PRESSURE.normal)}）`);
  }
  console.log(`（本轮击杀回合最大偏差 ${pct(worstDev)}）`);
  if (worstDev < 0.12 && round >= 3) { console.log('✅ 已经收敛，提前结束'); break; }
}

// 单调下限：章节越深敌人只强不弱（攻击力的档位顺序由系数表保证，这里只管逐章递增）
for (let s = 1; s < STAGES; s++) {
  if (baseAtk[s] < baseAtk[s - 1] * 1.08) baseAtk[s] = baseAtk[s - 1] * 1.08;
}
for (const tier of TIERS) {
  for (let i = 1; i < STAGES; i++) {
    if (hp[tier][i] < hp[tier][i - 1] * 1.05) hp[tier][i] = hp[tier][i - 1] * 1.05;
  }
}
apply();

// ---------- 复核 ----------
console.log('\n=== 复核（写进去的最终值，逐格实测） ===');
console.log(pad('档位', 8) + pad('章节', 7) + pad('HP', 7) + pad('回合', 7) + pad('目标', 7) +
  pad('ATK', 6) + pad('每回合压力', 11) + pad('最凶回合', 10) + pad('胜率', 8) + '意图上界');
for (const tier of TIERS) {
  for (let stage = 0; stage < STAGES; stage++) {
    const r = probeTier(stage, tier, N);
    console.log(
      pad(tier, 8) + pad('第' + (stage + 1) + '章', 7) + pad(Math.round(hp[tier][stage]), 7) +
      pad((r.turnsWon || 0).toFixed(2), 7) + pad(TURNS[tier].toFixed(1), 7) +
      pad(Math.round(baseAtk[stage] * TIER_ATK_MUL[tier]), 6) + pad(pct(r.pressure), 11) +
      pad(pct(r.worst), 10) + pad(pct(r.rate), 8) + pct(r.threat),
    );
  }
}

const outHp = {}, outAtk = {};
for (const tier of TIERS) {
  outHp[tier] = Array.from({ length: STAGES }, (_, s) => Math.max(15, Math.round(hp[tier][s])));
  outAtk[tier] = Array.from({ length: STAGES }, (_, s) => Math.max(3, Math.round(baseAtk[s] * TIER_ATK_MUL[tier])));
}
console.log('\n新的 enemyHp 表：');
for (const tier of TIERS) console.log(`    ${tier}: [${outHp[tier].join(', ')}],`);
console.log('新的 enemyAtk 表：');
for (const tier of TIERS) console.log(`    ${tier}: [${outAtk[tier].join(', ')}],`);
console.log('（校验：每一章的攻击力都必须 杂兵 < 较强 < 精英 < 首领）');
for (let s = 0; s < STAGES; s++) {
  const row = TIERS.map((t) => outAtk[t][s]);
  const okOrder = row.every((v, i) => i === 0 || row[i - 1] < v);
  console.log(`    第${s + 1}章 ${row.join(' < ')} ${okOrder ? '✓' : '✗ 顺序不对'}`);
}

if (WRITE) {
  const file = path.join(ROOT, 'src', 'data', 'balance.js');
  let text = await fs.readFile(file, 'utf8');
  const blockRe = (name, tier) => new RegExp(`(${name}: \\{[^}]*?\\n\\s*${tier}: \\[)[^\\]]*(\\])`, 's');
  for (const tier of TIERS) {
    for (const [name, table] of [['enemyHp', outHp], ['enemyAtk', outAtk]]) {
      const re = blockRe(name, tier);
      if (!re.test(text)) { console.error(`✗ 没找到 ${name}.${tier}，没写文件`); process.exit(1); }
      text = text.replace(re, `$1${table[tier].join(', ')}$2`);
    }
  }
  await fs.writeFile(file, text, 'utf8');
  console.log('\n已写入 src/data/balance.js');
} else {
  console.log('\n（没有写文件；加 --write 才会写进 src/data/balance.js）');
}
