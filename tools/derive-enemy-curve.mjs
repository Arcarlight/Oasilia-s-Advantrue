// 敌人战力曲线推导：**先定「打几回合」和「每回合掉多少血」，再反推血量与攻击**。
//
// 为什么改成这样（用户反馈）：「后面会有怪血量接近 2000，虽然玩家能过，但会被强行拉长战局」。
// 旧做法是对每个（档位 × 章节）二分搜索敌人 HP 让「胜率」命中目标曲线 ——
// 胜率凑对了，代价全压在血量上：后期怪变成血包，一场磨五六回合，赢也赢得难受。
// 而「难度 = 回合数 × 每回合压力」，回合数应该是**设计目标**，不是搜索结果。
//
// 现在的推导只有两次**单向测量**，没有搜索、没有互相耦合（前两版用固定点迭代，
// 结果在「加血 → 玩家被打死 → 回合数变短 → 再加血」之间来回震荡，表完全不可用）：
//   ① 把敌人血量撑到打不死，量出玩家每回合能打多少伤害  → DPT
//   ② 把敌人攻击固定成 20，量出「每 1 点攻击、每回合能打掉玩家多少血」 → RATE
//   然后：
//     血量 = DPT × targetTurns / 池子混合系数
//     攻击 = 目标每回合压力 × 玩家最大生命 / RATE / 池子混合系数
//
// 「池子混合系数」是必要的：一场「普通战斗」是从「杂兵 + 较强」两个池子里随机抽一只，
// 所以量到的是混合结果。杂兵血量/攻击按「较强的 70%」派生，代入混合比例
// （杂兵 45 只 / 较强 19 只 → 杂兵占 70.3%）得到系数 0.789。
// 不修正这个系数，就会推出「较强的怪比精英还厚」这种反直觉的表（前一版就是这样）。
//
// 用法:
//   node tools/derive-enemy-curve.mjs            只测量并打印建议表
//   node tools/derive-enemy-curve.mjs --write    写进 src/data/balance.js
//   node tools/derive-enemy-curve.mjs --write 40 每个探针 40 场（默认 30）
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
const { BALANCE } = await imp('src/data/balance.js');
const { STARTER_DECK, rollCard } = await imp('src/data/cards.js');
const { STAGE_BIOME } = await imp('src/data/balance.js');
const { ENEMIES } = await imp('src/data/enemies.js');

/** 目标击杀回合（难度的一部分） */
const TURNS = BALANCE.targetTurns;

/**
 * 目标「每回合压力」：敌人一回合能打掉玩家最大生命的多少。
 *
 * 这两个数才是难度本身 —— 回合数固定之后，胜率完全由它决定。
 * 取值的依据：一场战斗要打 T 回合，玩家总共会掉 P×T 的血；
 *   杂兵 8% × 2 = 16%（纯消耗，注意累积）
 *   较强 13% × 2.5 = 33%
 *   精英 20% × 3.5 = 70%（不靠护盾/治疗就会掉到危险线）
 *   首领 26% × 4.5 = 117%（必须靠护盾与治疗撑过一轮，这就是首领战的玩法）
 */
const PRESSURE = { mob: 0.08, normal: 0.13, elite: 0.20, boss: 0.13 };
/** 杂兵 = 较强的这个比例（两个池子混在一起量，只能靠这个比例区分） */
const MOB_RATIO = 0.7;
/** 量「每点攻击的伤害」时用的参考攻击力（太低会被取整吃掉精度） */
const REF_ATK = 20;

/** 各章开始时的玩家画像（和 measure-balance / tune-curve 保持一致，改动要同步） */
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
 * 这里必须跟 measure-balance 用同一套，否则两个工具会对同一张表给出完全不同的胜率 ——
 * 实测踩过：上一版从一份「全是强力牌」的固定池里抽，第 1 章的牌组比真实情况强一大截
 * （12 张里有 2 张地震/蛮力），推出来的第 1 章精英攻击力 26 让真·起始卡组只有 11% 胜率，
 * 而推导工具自己量出 73%。两套模型一对齐，两个工具就一致了。
 */
function buildDeck(size) {
  const out = STARTER_DECK.slice(0, size);
  let guard = 0;
  while (out.length < size && guard++ < 200) out.push(rollCard(0.12, []).id);
  return out;
}

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
void mulberry;   // 牌组改用按稀有度加权的奖励抽取，不再用这个种子发生器
/** 贪婪 AI：能打就打分数最高的（和 tune-curve / measure-balance 一致） */
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
  // 而那意味着后面几章一直在打**沙漠的怪**（属性包 / 首领都不对）。
  // 这里把 biome 一起改掉，让每一章打的是它自己的怪。
  game.data.map.biome = STAGE_BIOME[Math.min(STAGE_BIOME.length - 1, stage)];
  game.data.deck = buildDeck(g.deck);
  game.data.battleDeck = null;
  return game;
}

/**
 * 跑 runs 场，返回胜率、**获胜局的**平均回合数与打完剩余血量比例。
 *
 * 只用获胜局算回合数：玩家被打死的局回合数天然很短，
 * 混进来会让工具误以为「这一档打得太快」从而疯狂加血（第一版就是这么把首领顶回 1857 的）。
 */
function probe(stage, kind, runs) {
  let wins = 0, turnsWon = 0, hpPct = 0, turns = 0;
  for (let i = 0; i < runs; i++) {
    const game = makeGame(stage, i);
    game.startBattle(kind, 4);      // nodeIndex 4 ≈ 章中段
    const b = game.battle;
    let guard = 0;
    while (!b.over && guard++ < 200) {
      if (b.active === 'player') autoPlay(b);
      b.endTurn();
      b.takeEvents();
    }
    const win = b.winner === 'player';
    if (win) { wins++; turnsWon += b.turn; }
    turns += b.turn;
    hpPct += Math.max(0, b.player.hp) / b.player.maxHp;
  }
  return {
    rate: wins / runs,
    turns: turns / runs,
    turnsWon: turnsWon / Math.max(1, wins),
    hpPct: hpPct / runs,
  };
}

/**
 * 「每 1 点攻击、每回合能打掉玩家多少血」。
 * 把敌人攻击固定成 REF_ATK 量一遍，再除以 REF_ATK —— 单向测量，不需要搜索。
 * 这里也必须只顶 **hp**（打不死），不能动 maxHp：持续伤害按最大生命的百分比结算，
 * 改大 maxHp 会让一层出血打出上万伤害（第一版 DPT 量出 5000+ 就是这么来的）。
 */
function measureRate(stage, kind, runs) {
  let dmg = 0, turns = 0;
  for (let i = 0; i < runs; i++) {
    const game = makeGame(stage, i);
    game.startBattle(kind, 4);
    const b = game.battle;
    b.enemy.atk = REF_ATK;
    const keepAlive = () => { b.enemy.hp = Math.max(b.enemy.hp, b.enemy.maxHp * 3); };
    keepAlive();
    let t = 0;
    const sink = (ev) => {
      if ((ev.type === 'damage' || ev.type === 'trueDamage') && ev.side === 'player') dmg += ev.amount;
    };
    while (!b.over && t < 5) {
      if (b.active === 'player') { t += 1; autoPlay(b, sink); }
      for (const ev of b.takeEvents()) sink(ev);
      keepAlive();
      if (t >= 5) break;
      b.endTurn();
      for (const ev of b.takeEvents()) sink(ev);
    }
    turns += t;
  }
  return dmg / Math.max(1, turns) / REF_ATK;
}

const STAGES = BALANCE.enemyHp.mob.length;
const TIERS = ['mob', 'normal', 'elite', 'boss'];
const kindOf = (tier) => (tier === 'mob' || tier === 'normal' ? 'normal' : tier);
const pad = (s, n) => String(s).padEnd(n);

// 池子里杂兵占多少（决定「混合系数」）
const mobCount = ENEMIES.filter((e) => e.tier === 'mob').length;
const normalCount = ENEMIES.filter((e) => e.tier === 'normal').length;
const mobShare = mobCount / (mobCount + normalCount);
const MIX = MOB_RATIO * mobShare + (1 - mobShare);

console.log(`① 敌人「每 1 点攻击、每回合能打掉玩家多少血」（每格 ${N} 场）`);
console.log(`   杂兵池 ${mobCount} 只 / 较强池 ${normalCount} 只 → 杂兵占比 ${(mobShare * 100).toFixed(1)}%，混合系数 ${MIX.toFixed(3)}`);
const RATE = {};
for (let stage = 0; stage < STAGES; stage++) {
  RATE[stage] = {};
  for (const kind of ['normal', 'elite', 'boss']) RATE[stage][kind] = measureRate(stage, kind, N);
  console.log(
    pad('第' + (stage + 1) + '章', 6) + pad('普通战斗', 11) + pad('精英', 10) + pad('首领', 10) +
    `普通 ${RATE[stage].normal.toFixed(3)} / 精英 ${RATE[stage].elite.toFixed(3)} / 首领 ${RATE[stage].boss.toFixed(3)}`,
  );
}

// ============================================================
// 阶段 A：按「实测击杀回合数」迭代血量
// ============================================================
//
// 状态的唯一变量是**混合池血量**（hpHint.normal）——因为一场「普通战斗」是从
// 「杂兵 + 较强」两个池子里随机抽一只，探针量到的就是这两种怪的混合结果，
// 想同时定出两行是信息不足的（前几版会解出「杂兵攻击 80、较强攻击 11」这种无意义的组合）。
// 所以：杂兵恒 = 较强的 70%，两行都由混合值派生，反推出的混合值天然是对的。
const hpHint = {
  normal: new Array(STAGES).fill(60),   // 「混合池」血量
  elite: new Array(STAGES).fill(60),
  boss: new Array(STAGES).fill(60),
};
/** 把状态写进 BALANCE（探针读的是它） */
function applyHp() {
  for (let s = 0; s < STAGES; s++) {
    const normal = Math.max(15, Math.round(hpHint.normal[s] / MIX));
    BALANCE.enemyHp.normal[s] = normal;
    BALANCE.enemyHp.mob[s] = Math.max(12, Math.round(normal * MOB_RATIO));
    BALANCE.enemyHp.elite[s] = Math.max(15, Math.round(hpHint.elite[s]));
    BALANCE.enemyHp.boss[s] = Math.max(15, Math.round(hpHint.boss[s]));
  }
}

/**
 * 迭代血量，使实测击杀回合逼近 targetTurns。
 * 从「很小」起步往上爬：血量与击杀回合近似成正比，从下面爬比从上面掉稳定得多
 * （从一张偏大的旧表起步时，几轮根本收不回来）。
 */
function fixpointHp(rounds, label) {
  for (let round = 1; round <= rounds; round++) {
    console.log(`\n--- ${label} 第 ${round} 轮 ---`);
    console.log(pad('档位', 8) + pad('章节', 7) + pad('目标回合', 10) + pad('实测回合', 10) + pad('胜率', 8) + pad('旧HP', 8) + '新HP');
    let worst = 0;
    for (const key of ['normal', 'elite', 'boss']) {
      for (let stage = 0; stage < STAGES; stage++) {
        applyHp();
        const r = probe(stage, key, N);
        const target = TURNS[key === 'normal' ? 'normal' : key];
        const oldHp = hpHint[key][stage];
        // 只统计**获胜局**的回合数：被打死的局回合数天生短，混进来会把「打得太快」误判成需要加血
        const measured = r.turnsWon || r.turns;
        const ratio = Math.max(0.3, Math.min(4, target / Math.max(0.3, measured)));
        const damped = 1 + (ratio - 1) * 0.75;
        hpHint[key][stage] = Math.max(15, Math.round(oldHp * damped));
        worst = Math.max(worst, Math.abs(measured - target) / target);
        console.log(
          pad(key === 'normal' ? '杂兵+较强' : key, 8) + pad('第' + (stage + 1) + '章', 7) + pad(target.toFixed(1), 10) +
          pad(measured.toFixed(2), 10) + pad((r.rate * 100).toFixed(0) + '%', 8) + pad(oldHp, 8) + hpHint[key][stage],
        );
      }
    }
    console.log(`（本轮最大偏差 ${(worst * 100).toFixed(0)}%）`);
    if (worst < 0.1) { console.log('✅ 已经收敛，提前结束'); break; }
  }
}

console.log('\n=== 阶段 A：先关掉攻击力，只让血量这一个变量说话 ===');
for (const tier of TIERS) for (let s = 0; s < STAGES; s++) BALANCE.enemyAtk[tier][s] = 3;
fixpointHp(6, '阶段 A（攻击力 3）');

// ---------- 阶段 B：攻击力 = 目标压力 × 玩家最大生命 ÷ RATE ÷ 混合系数 ----------
console.log('\n=== 阶段 B：攻击力 = 目标每回合压力 × 玩家最大生命 ÷ RATE ÷ 混合系数 ===');
console.log(pad('档位', 8) + pad('章节', 7) + pad('压力/回合', 11) + pad('HP', 8) + pad('ATK', 7) + '推算依据');
const nextAtk = {};
for (const tier of TIERS) nextAtk[tier] = [];
for (let stage = 0; stage < STAGES; stage++) {
  const pMaxHp = GROWTH[stage].maxHp;
  for (const tier of TIERS) {
    const kind = kindOf(tier);
    const mix = tier === 'mob' || tier === 'normal' ? MIX : 1;
    const rate = Math.max(1e-6, RATE[stage][kind]);
    let atk = (PRESSURE[tier] * pMaxHp) / rate / mix;
    if (tier === 'mob') atk *= MOB_RATIO;
    nextAtk[tier][stage] = Math.max(3, Math.round(atk));
    const normalHp = Math.round(hpHint.normal[stage] / MIX);
    const shownHp = tier === 'normal' ? normalHp
      : tier === 'mob' ? Math.round(normalHp * MOB_RATIO) : Math.round(hpHint[tier][stage]);
    console.log(
      pad(tier, 8) + pad('第' + (stage + 1) + '章', 7) + pad((PRESSURE[tier] * 100).toFixed(0) + '%', 11) +
      pad(shownHp, 8) + pad(nextAtk[tier][stage], 7) +
      `RATE ${rate.toFixed(3)}${mix !== 1 ? ` × 混合系数 ${mix.toFixed(3)}` : ''}`,
    );
  }
}

// ---------- 阶段 A′：把攻击力装回去，再收敛一次血量 ----------
// 为什么还需要一轮：敌人**真的会打疼你**之后，玩家会把 AP 花在治疗 / 护盾上
// （贪婪 AI 在血量低时给回血牌打高分），战斗因此被拉长。
// 阶段 A 是在「攻击力 3」下量的，装回真攻击力之后实测回合会涨一截（实测 2.5 → 3.8）。
// 这次攻击力是固定的，一维收敛很稳。
console.log('\n=== 阶段 A′：装回真攻击力，再收敛一次血量 ===');
for (const tier of TIERS) for (let s = 0; s < STAGES; s++) BALANCE.enemyAtk[tier][s] = nextAtk[tier][s];
fixpointHp(5, '阶段 A′（真攻击力）');

// 单调下限：章节越深敌人只强不弱
for (const key of ['normal', 'elite', 'boss']) {
  for (let i = 1; i < STAGES; i++) {
    if (hpHint[key][i] < hpHint[key][i - 1] * 1.05) hpHint[key][i] = Math.round(hpHint[key][i - 1] * 1.05);
  }
}
for (const tier of TIERS) {
  for (let i = 1; i < STAGES; i++) {
    if (nextAtk[tier][i] < nextAtk[tier][i - 1] * 1.03) nextAtk[tier][i] = Math.ceil(nextAtk[tier][i - 1] * 1.03);
  }
}
// 血量单调之后可能又被推出目标回合，再补一轮小幅收敛
fixpointHp(2, '阶段 A″（单调性修正后）');

applyHp();
const nextHp = {
  mob: [...BALANCE.enemyHp.mob],
  normal: [...BALANCE.enemyHp.normal],
  elite: [...BALANCE.enemyHp.elite],
  boss: [...BALANCE.enemyHp.boss],
};

// ---------- 阶段 C：全部写进去，实测复核 ----------
console.log('\n=== 阶段 C：复核（实际回合数 / 胜率 / 打完剩多少血） ===');
console.log(pad('档位', 8) + pad('章节', 7) + pad('目标回合', 10) + pad('实测回合', 10) + pad('胜率', 8) + pad('剩血', 8) + 'HP/ATK');
for (const tier of TIERS) {
  for (let stage = 0; stage < STAGES; stage++) {
    BALANCE.enemyHp[tier][stage] = nextHp[tier][stage];
    BALANCE.enemyAtk[tier][stage] = nextAtk[tier][stage];
  }
}
for (const tier of TIERS) {
  for (let stage = 0; stage < STAGES; stage++) {
    const r = probe(stage, kindOf(tier), N);
    console.log(
      pad(tier, 8) + pad('第' + (stage + 1) + '章', 7) + pad(TURNS[tier].toFixed(1), 10) +
      pad(r.turns.toFixed(2), 10) + pad((r.rate * 100).toFixed(0) + '%', 8) +
      pad((r.hpPct * 100).toFixed(0) + '%', 8) + `${nextHp[tier][stage]} / ${nextAtk[tier][stage]}`,
    );
  }
}

console.log('\n新的 enemyHp 表：');
for (const tier of TIERS) console.log(`    ${tier}: [${nextHp[tier].join(', ')}],`);
console.log('新的 enemyAtk 表：');
for (const tier of TIERS) console.log(`    ${tier}: [${nextAtk[tier].join(', ')}],`);

if (WRITE) {
  const file = path.join(ROOT, 'src', 'data', 'balance.js');
  let text = await fs.readFile(file, 'utf8');
  const blockRe = (name, tier) => new RegExp(`(${name}: \\{[^}]*?\\n\\s*${tier}: \\[)[^\\]]*(\\])`, 's');
  for (const tier of TIERS) {
    for (const [name, table] of [['enemyHp', nextHp], ['enemyAtk', nextAtk]]) {
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
