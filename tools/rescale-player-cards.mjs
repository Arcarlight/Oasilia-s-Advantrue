// 把**玩家能抽到的卡池**拉到「不能低于开局那几张」的水位，并修掉三类让玩家觉得『又贵又没用』的牌。
//
// 起因（玩家反馈，用户转述）：
//   · 「为了各种属性都有卡而给敌人添加的一些卡牌……1c 打 80% 威力的小垃圾，然后随机给一点迷效果
//      的卡，这种卡牌不该污染玩家抽选的卡池，玩家能抽到的卡池强度不能低于开始携带的二连踢、撞击等」
//   · 「高费卡也有很多那种 AP 效率低的卡」
//   · 「现在的无视防御效果也很差，还会因为词条权重高而让卡牌又贵又没用」
//
// 三条规则（这个脚本就是它们的实现，`tools/author.mjs check` 里也会复查）：
//
//   ① **代价流的牌要有补偿**。`buff` 默认打自己（battle.js：target 不是 'enemy' 就作用在施法者身上），
//      所以「近身战 / 流星群 / 蛮力 / 飞叶风暴…」这类**本场战斗自己掉属性**的牌是有意设计
//      （卡面文案写的就是「本场战斗防御 -4」，和效果一致 —— 我核对过，不是 bug）。
//      但它们必须**比同档水位更高**才划算：掉属性的代价要换来明显更大的威力。
//      规则：带「自己掉属性」或「自伤 / 反作用力」的牌，水位 × 1.2。
//      ⚠ 第一版想把这些 rider 直接翻成「打对手」——那是错的：会把卡面文案变成假话
//      （文案写「本场战斗防御 -4」，效果却去打对手了）。
//   ② **每 AP 威力随费用不降**。现状是反的：1 费 85/AP、2 费 80/AP、3 费 78/AP ——
//      越贵越不划算，所以「攒一堆 AP 打一张大牌」永远不如「1 费牌连打」。
//      处理：按下面的曲线把 1~4 费的伤害抬到该档水位。
//   ③ **无视防御要值钱**。30% 无视在防御 40 的对手身上只多打 15%（实测），
//      却让这张牌在「词条预算」里被扣掉威力 —— 又贵又没用。
//      处理：把无视比例抬到 50% / 70%（100% 的那两张本来就是招牌），并且不再因为它扣威力。
//
// 用法：
//   node tools/rescale-player-cards.mjs            # 只报告（dry run）
//   node tools/rescale-player-cards.mjs --apply    # 写回 content/cards.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'content', 'cards.json');
const APPLY = process.argv.includes('--apply');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

/**
 * 每一条 AP 的**威力水位**（纯伤害牌的伤害预算）。
 * 曲线是**递增**的：越贵的一张越该「一张顶更多」，否则没人愿意攒 AP 打大牌。
 * 1 费 90 对齐开局的二连踢（90）；2 费 / 3 费 / 4 费依次抬上去。
 *
 * ⚠ **0 费必须留在 30**：开局那几张 0 费牌（撞击 / 泼沙）就是这一档的标尺，
 *   它们的作用是「没 AP 时也能出牌」，不是输出主力。
 *   第一版的写法是 `TARGET[card.ap] ?? 90` —— 0 费在表里没有键，于是**整档被抬到 90**：
 *   撞击从 30 变成 90（三倍），十几种 0 费牌一起被静默加强。
 *   这是 dry run 之后、看「0 费却打出高伤害的卡」那份报告时才发现的。
 */
const TARGET = { 0: 30, 1: 90, 2: 190, 3: 285, 4: 420 };
/** 没写进表里的费用（5 费以上）按 4 费的水位再往上抬一点 */
const waterFor = (ap) => TARGET[ap] ?? (ap >= 5 ? TARGET[4] + (ap - 4) * 105 : 30);
const dmgOf = (card) => (card.effects ?? []).filter((e) => e.kind === 'damage')
  .reduce((n, e) => n + (e.power ?? 0) * (e.hits ?? 1), 0);
/** 无视防御的「补偿水位」：带这个词条的牌，威力要求打折（它本来就该是白送的加成） */
const PIERCE_FIX = { 0.3: 0.5, 0.5: 0.7 };

const changes = { premium: [], power: [], pierce: [] };

/** 这张牌是不是「拿代价换威力」的那种（自己掉属性 / 自伤 / 反作用力） */
function hasSelfCost(card) {
  return (card.effects ?? []).some((e) => (
    (e.kind === 'buff' && (e.amount ?? 0) < 0 && e.target !== 'enemy')
    || e.kind === 'selfDmg'
    || (e.kind === 'damage' && (e.recoilPct ?? 0) > 0)
  ));
}

/**
 * 把 power 分配到这张牌的伤害效果上（多段牌按原比例分），保持 hits 不变。
 * 只改 power，不动别的字段 —— 这样卡面文案里的 {d} 是引擎现算的，不用改文案。
 */
function setDamage(card, total) {
  const hits = (card.effects ?? []).filter((e) => e.kind === 'damage');
  if (!hits.length) return;
  const old = dmgOf(card);
  let left = total;
  hits.forEach((e, i) => {
    const share = i === hits.length - 1 ? left : Math.round((total * (e.power * (e.hits ?? 1))) / Math.max(1, old));
    e.power = Math.max(1, Math.round(share / (e.hits ?? 1)));
    left = total - hits.slice(0, i + 1).reduce((n, x) => n + x.power * (x.hits ?? 1), 0);
  });
}

for (const card of data.cards) {
  if (card.enemyOnly) continue;                     // 只给敌人用的牌：弱一点无所谓，不进玩家池
  const dmg = dmgOf(card);
  const effects = card.effects ?? [];

  /**
   * ① 代价流（自己掉属性 / 自伤）→ **水位 ×1.2**（威力补偿）。
   *
   * 不翻 target：那些牌的卡面文案写的就是「本场战斗防御 -4」（和效果一致，是刻意设计），
   * 把效果改成打对手会让文案变成假话 —— 第一版就是这么打算的，dry run 时看出来了。
   * 补偿系数 1.2 是「值得为它掉 3~4 点属性」的直觉水位，写在下面这条乘法里。
   */
  const water = waterFor(card.ap);
  const target0 = hasSelfCost(card) ? Math.round(water * 1.2) : water;
  if (dmg > 0 && dmg < target0) {
    changes[hasSelfCost(card) ? 'premium' : 'power'].push({ id: card.id, name: card.name, ap: card.ap, from: dmg, to: target0, cost: hasSelfCost(card) });
    setDamage(card, target0);
  }

  // ③ 无视防御抬比例
  for (const e of effects) {
    if (e.kind === 'damage' && e.ignoreDefPct && PIERCE_FIX[e.ignoreDefPct]) {
      changes.pierce.push({ id: card.id, name: card.name, from: e.ignoreDefPct, to: PIERCE_FIX[e.ignoreDefPct] });
      e.ignoreDefPct = PIERCE_FIX[e.ignoreDefPct];
    }
  }
}

const show = (title, list, fmt) => {
  console.log(`\n=== ${title}（${list.length} 张）===`);
  for (const c of list.slice(0, 60)) console.log('  ' + fmt(c));
  if (list.length > 60) console.log(`  …还有 ${list.length - 60} 张`);
};
show('① 代价流的牌（自己掉属性 / 自伤）→ 威力再抬 20%', changes.premium,
  (c) => `${c.name.padEnd(8)} ${c.ap}费 ${String(c.from).padStart(4)} → ${String(c.to).padStart(4)}（比同档水位高 20%，用来补偿代价）`);
show('② 威力抬到该档水位（每 AP 随费用递增）', changes.power,
  (c) => `${c.name.padEnd(8)} ${c.ap}费 ${String(c.from).padStart(4)} → ${String(c.to).padStart(4)}（${(c.from / Math.max(1, c.ap)).toFixed(0)} → ${(c.to / Math.max(1, c.ap)).toFixed(0)}/AP）`);
show('③ 无视防御抬比例', changes.pierce,
  (c) => `${c.name.padEnd(8)} 无视 ${Math.round(c.from * 100)}% → ${Math.round(c.to * 100)}%`);

const total = changes.premium.length + changes.power.length + changes.pierce.length;
if (APPLY) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\n✓ 已写回 content/cards.json（${total} 处改动）`);
  console.log('  接着跑：node tools/build-content.mjs && node tools/author.mjs check');
} else {
  console.log(`\n（dry run：${total} 处改动，加 --apply 才写回）`);
}
