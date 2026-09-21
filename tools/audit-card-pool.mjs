// 体检：**玩家能抽到的卡池**到底有多强 / 有多划算。
//
// 起因（玩家反馈，用户转述）：
//   「先前为了各种属性都有卡而给敌人添加的一些卡牌不光很多一看全是 1c 打 80% 威力的小垃圾，
//     然后随机给一点迷效果的卡，这种卡牌不该污染玩家抽选的卡池，
//     玩家能抽到的卡池强度不能低于开始携带的二连踢、撞击等；
//     以及高费卡也有很多那种 AP 效率低的卡，现在的无视防御效果也很差，
//     还会因为词条权重高而让卡牌又贵又没用。」
//
// 这份脚本回答三个问题：
//   ① 玩家池里（`enemyOnly` 之外的）有哪些卡的**每 AP 伤害**低于开局那几张？
//   ② 高费（ap ≥ 2）里哪些卡的效率明显低于 1 费牌？
//   ③ 带「无视防御」的卡，**实际赚到多少**？值不值它多出来的费用 / 权重？
//
// 用法：
//   node tools/audit-card-pool.mjs              # 全部报告
//   node tools/audit-card-pool.mjs --only-junk  # 只列「低于地板」的卡
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { CARDS } = await import(new URL('../src/data/cards.js', import.meta.url).href);
const { BALANCE } = await import(new URL('../src/data/balance.js', import.meta.url).href);
const ONLY_JUNK = process.argv.includes('--only-junk');

/** 开局卡组（玩家一上来就有的那几张）——它们就是「地板」的基准 */
const { STARTER_DECK } = await import(new URL('../src/data/cards.js', import.meta.url).href);
const byId = new Map(CARDS.map((c) => [c.id, c]));

/** 一张牌的「伤害预算」：把所有 damage 效果的 power × hits 加起来 */
const damageBudget = (card) => (card.effects ?? [])
  .filter((e) => e.kind === 'damage')
  .reduce((n, e) => n + (e.power ?? 0) * (e.hits ?? 1), 0);

/** 其它效果的「预算」（护盾 / 回复 / 抽牌 / 状态层数）—— 用于判断一张牌是不是「纯小垃圾」 */
const utilityBudget = (card) => (card.effects ?? [])
  .filter((e) => e.kind !== 'damage')
  .reduce((n, e) => {
    if (e.kind === 'shield') return n + (e.amount ?? 0) * 0.5;
    if (e.kind === 'heal') return n + (e.amount ?? 0) * 0.5 + (e.pct ?? 0) * 100;
    if (e.kind === 'status') return n + (e.stacks ?? 0) * 12;
    if (e.kind === 'draw') return n + (e.n ?? 1) * 25;
    if (e.kind === 'ap') return n + (e.n ?? 1) * 40;
    if (e.kind === 'buff') return n + (Math.abs(e.amount ?? 0)) * 6;
    return n + 5;
  }, 0);

/** 命中一段「这个强度的伤害」在某个防御力下还剩多少（和引擎同一条公式） */
const afterDef = (power, def, ignoreDefPct = 0) => {
  const K = BALANCE.armorK;
  return (power * K) / (K + def * (1 - ignoreDefPct));
};

const DEF_SAMPLE = 30;                 // 中后期一只普通怪的防御力（第 4~5 章量级）
const score = (card) => damageBudget(card) / Math.max(1, card.ap);

const starter = STARTER_DECK.map((id) => byId.get(id)).filter(Boolean);
console.log('=== 开局携带的卡（这就是「地板」）===');
for (const c of starter) {
  const dmg = damageBudget(c);
  console.log(`  ${c.name.padEnd(6)} ${c.ap}费 ${String(dmg).padStart(4)} 威力` +
    `${dmg ? ` → 每 AP ${(dmg / Math.max(1, c.ap)).toFixed(0)}` : '（没伤害，是辅助牌）'}` +
    `${utilityBudget(c) ? `（另有其它效果，预算 ${utilityBudget(c).toFixed(0)}）` : ''}`);
}
/**
 * 地板 = **开局那几张攻击牌里最低的每 AP 威力**。
 * 只算带伤害的牌：变硬 / 羽栖那种辅助牌没有伤害，拿它们当基准会把地板算成 0
 * （第一版就是这么算的，于是「低于地板的卡」永远是 0 张 —— 报告自己骗自己）。
 */
const starterAttack = starter.filter((c) => damageBudget(c) > 0);
const floor = Math.min(...starterAttack.map(score));
const floorCard = starterAttack.find((c) => score(c) === floor);
console.log(`  → 地板 = ${floorCard.name} 的 ${floor.toFixed(0)} 威力/AP（0 费的撞击按 1 费算，30/AP）`);

/** 每一条 AP 的**期望效率**：贵的牌一张顶更多，所以每 AP 应该更高（用户抱怨的就是这条反了） */
const CURVE = { 0: 30, 1: 90, 2: 175, 3: 265, 4: 360, 5: 460 };
console.log(`  → 期望效率曲线（纯伤害牌）：${Object.entries(CURVE).map(([ap, p]) => `${ap}费≈${p}`).join(' · ')}`);
const curveFor = (ap) => CURVE[Math.min(5, ap)] ?? CURVE[5];

const pool = CARDS.filter((c) => !c.enemyOnly);
const bench = CARDS.filter((c) => c.enemyOnly);
console.log(`\n=== 卡池规模 ===`);
console.log(`  玩家能抽到的：${pool.length} 张 · 只给敌人用的（enemyOnly）：${bench.length} 张`);

// ---------- ① 玩家池里低于地板的卡 ----------
/**
 * 判断一张牌「是不是小垃圾」：
 *   · 有伤害，但**总预算**（伤害 + 其它效果折算）连同一费用档的期望都达不到；
 *   · 另外单独看「纯伤害牌」的效率有没有低于地板（开局那几张）。
 * `utilityBudget` 是粗算的等价威力（护盾 0.5/点、状态 12/层、抽 1 张 25、1 AP 40），
 * 所以「威力 80 + 附赠 1 层中毒」这种牌能算出来它到底值不值 1 费。
 */
const budget = (card) => damageBudget(card) + utilityBudget(card);
const junk = pool.filter((c) => budget(c) < curveFor(c.ap) * 0.8);
console.log(`\n=== ① 玩家池里「总预算明显不够」的卡（${junk.length} 张，按费用档的 80% 当线）===`);
for (const c of junk.slice().sort((a, b) => (budget(a) / curveFor(a.ap)) - (budget(b) / curveFor(b.ap)))) {
  const dmg = damageBudget(c);
  const riders = (c.effects ?? []).filter((e) => e.kind !== 'damage')
    .map((e) => `${e.kind}${e.status ? ':' + e.status : ''}${e.stacks != null ? '×' + e.stacks : ''}${e.amount != null ? '×' + e.amount : ''}${e.n != null ? '×' + e.n : ''}`)
    .join('+');
  console.log(`  ${c.name.padEnd(8)} ${c.ap}费 威力 ${String(dmg).padStart(4)}${riders ? ` + [${riders}]` : ''}` +
    ` → 预算 ${budget(c).toFixed(0)} / 该档 ${curveFor(c.ap)}（${Math.round((budget(c) / curveFor(c.ap)) * 100)}%）` +
    ` · ${(c.types ?? []).join('/')} · ${c.rarity}`);
}

// ---------- ② 高费低效 ----------
/**
 * 只对**带伤害**的牌判「划算不划算」：
 * 辅助牌（护盾 / 抽牌 / 状态）没有伤害，用「每 AP 伤害」量它们本身就是错的
 * —— 第一版把它们全列成「高费低效」，读报告的人会以为要改 21 张牌。
 * 辅助牌只看一件事：它有没有别的本事（下面的 ②b 单独列信息）。
 */
const damageCards = pool.filter((c) => damageBudget(c) > 0);
const expensive = damageCards.filter((c) => c.ap >= 2 && (damageBudget(c) / c.ap) < floor);
console.log(`\n=== ② 高费（≥2）伤害牌里比 1 费牌还不划算的（${expensive.length} 张）===`);
for (const c of expensive.slice().sort((a, b) => score(a) - score(b))) {
  console.log(`  ${c.name.padEnd(8)} ${c.ap}费 威力 ${String(damageBudget(c)).padStart(4)} → ${score(c).toFixed(0)}/AP` +
    `（地板 ${floor.toFixed(0)}）· 其它预算 ${utilityBudget(c).toFixed(0)} · ${c.rarity}`);
}
console.log(`  （玩家池里的伤害牌共 ${damageCards.length} 张 · 辅助牌 ${pool.length - damageCards.length} 张，辅助牌不按「每 AP 伤害」判）`);

// ---------- ③ 无视防御到底赚多少（防御力越高越赚，所以按几档防御各算一遍）----------
const pierce = pool.filter((c) => (c.effects ?? []).some((e) => e.kind === 'damage' && (e.ignoreDefPct ?? 0) > 0));
console.log(`\n=== ③ 无视防御的卡（${pierce.length} 张）：不同防御力下实际赚多少 ===`);
console.log('   （对手防御越厚越划算；括号里是换算成「威力 +N%」的值）');
for (const c of pierce.slice().sort((a, b) => score(a) - score(b))) {
  const eff = c.effects.find((e) => e.kind === 'damage' && (e.ignoreDefPct ?? 0) > 0);
  const raw = (eff.power ?? 0) * (eff.hits ?? 1);
  const parts = [20, 40, 60].map((def) => {
    const normally = afterDef(raw, def, 0);
    const withPierce = afterDef(raw, def, eff.ignoreDefPct ?? 1);
    const gain = ((withPierce - normally) / Math.max(1, normally)) * 100;
    return `防${def}: +${gain.toFixed(0)}%`;
  });
  console.log(`  ${c.name.padEnd(8)} ${c.ap}费 威力 ${String(raw).padStart(4)} 无视 ${Math.round((eff.ignoreDefPct ?? 1) * 100)}%` +
    ` → ${parts.join(' · ')} · ${score(c).toFixed(0)}/AP`);
}

// ---------- ④ 只给敌人的那批：看看它们有多弱（它们就是「为了属性齐全」加的） ----------
console.log(`\n=== ④ 只给敌人的卡：强度分布（这批不进玩家池，弱一点没关系）===`);
const benchScores = bench.map(score).sort((a, b) => a - b);
console.log(`  每 AP 威力：最低 ${benchScores[0]?.toFixed(0)} · 中位 ${benchScores[Math.floor(benchScores.length / 2)]?.toFixed(0)} · 最高 ${benchScores[benchScores.length - 1]?.toFixed(0)}`);

if (ONLY_JUNK) process.exit(0);
