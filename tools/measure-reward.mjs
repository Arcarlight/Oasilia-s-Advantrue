// 战斗奖励的稀有度体检：打完普通怪 / 精英 / 首领，给的卡牌到底差多少。
//
// 为什么值得单独一个脚本：这条**曾经是坏的，而且所有体检都是绿的** ——
// 当时只有一个 `rarityBoost` 系数（普通 0.1 / 精英 0.45 / 首领 0.8），
// 而它的加成形状是「越稀有越小」（史诗 ×0.5、稀有 ×0.7、精良 ×1）：
// 加成几乎全被精良吃掉了，史诗占比从头到尾 3.5% 一条直线，玩家一眼看出来
// 「boss 和精英给的卡并没有更好」。现在稀有度按档位给（content/rarity.json 的
// rewardWeights），这个脚本就是量它、以及调数值时看后果的地方。
//
// 用法：
//   node tools/measure-reward.mjs          量当前实现
//   node tools/measure-reward.mjs old      量改动前那套（单一 boost + 旧加成形状）
//   node tools/measure-reward.mjs shop     量商店 / 营地冥想 / 事件给卡（rarityBoost 那一路）
import { rollCards, CARDS } from '../src/data/cards.js';
import { RARITY, REWARD_WEIGHTS, BALANCE } from '../src/data/balance.js';

const MODE = process.argv[2] ?? '';
const pool = CARDS.filter((c) => !c.enemyOnly);
const pickWeighted = (rows) => {
  const total = rows.reduce((s, [w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [w, v] of rows) { r -= w; if (r <= 0) return v; }
  return rows[rows.length - 1][1];
};

/** 改动前那套：单一 boost 系数 + 「越稀有加成越小」 */
const rollOld = (n, b) => {
  const out = []; const used = [];
  for (let i = 0; i < n; i += 1) {
    const rows = [];
    for (const c of pool) {
      if (used.includes(c.id)) continue;
      const mult = c.rarity === 'common' ? 1 : 1 + b * (c.rarity === 'epic' ? 0.5 : c.rarity === 'rare' ? 0.7 : 1);
      rows.push([RARITY[c.rarity].weight * mult, c]);
    }
    const c = pickWeighted(rows); out.push(c); used.push(c.id);
  }
  return out;
};

/** 改动后那套：rarityBoost 的加成形状也修了（越稀有加成越大） */
const rollNew = (n, b) => {
  const out = []; const used = [];
  for (let i = 0; i < n; i += 1) {
    const rows = [];
    for (const c of pool) {
      if (used.includes(c.id)) continue;
      const mult = 1 + b * (c.rarity === 'epic' ? 2 : c.rarity === 'rare' ? 1.5 : c.rarity === 'uncommon' ? 0.8 : 0);
      rows.push([RARITY[c.rarity].weight * mult, c]);
    }
    const c = pickWeighted(rows); out.push(c); used.push(c.id);
  }
  return out;
};

const N = 30000;
const score = { common: 0, uncommon: 1, rare: 2, epic: 3 };
const R = ['common', 'uncommon', 'rare', 'epic'];

/** 跑一个「每次抽 n 张」的场景，返回统计 */
function run(label, n, draw, chance = 1) {
  const per = { common: 0, uncommon: 0, rare: 0, epic: 0 };
  let withRarePlus = 0; let withEpic = 0; let bestSum = 0; let cards = 0; let offered = 0;
  for (let i = 0; i < N; i += 1) {
    if (Math.random() >= chance) continue;
    offered += 1;
    let best = 0; let hasRare = false; let hasEpic = false;
    for (const c of draw()) {
      per[c.rarity] += 1; cards += 1;
      best = Math.max(best, score[c.rarity]);
      if (c.rarity === 'rare' || c.rarity === 'epic') hasRare = true;
      if (c.rarity === 'epic') hasEpic = true;
    }
    bestSum += best;
    if (hasRare) withRarePlus += 1;
    if (hasEpic) withEpic += 1;
  }
  const p = (x) => `${(x / cards * 100).toFixed(1)}%`.padStart(6);
  console.log(`${label.padEnd(30)} ${String(n).padStart(2)} 张  ${R.map((r) => p(per[r])).join(' ')}`
    + `   ${`${(withRarePlus / offered * 100).toFixed(1)}%`.padStart(6)} / ${`${(withEpic / offered * 100).toFixed(1)}%`.padStart(5)}`
    + `   ${(bestSum / offered).toFixed(2)}`);
}

if (MODE === 'shop') {
  console.log('rarityBoost 那一路（商店 / 营地 / 事件）—— 旧形状 → 新形状');
  console.log('场景                             旧：史诗 / 至少一张史诗      新：史诗 / 至少一张史诗');
  for (const [label, b, n] of [
    ['商店（沙河马 0.35，5 张）', 0.35, 5],
    ['商店（独剑鞘黑市 0.75，6 张）', 0.75, 6],
    ['营地冥想（0.12 → 高稀有度）'.replace('0.12', '1.2'), 1.2, 1],
    ['事件给卡（0.4，1 张）', 0.4, 1],
  ]) {
    const stat = (draw) => {
      let cards = 0; let epic = 0; let withEpic = 0;
      for (let i = 0; i < N; i += 1) {
        let has = false;
        for (const c of draw()) { cards += 1; if (c.rarity === 'epic') { epic += 1; has = true; } }
        if (has) withEpic += 1;
      }
      return `${(epic / cards * 100).toFixed(1)}% / ${(withEpic / N * 100).toFixed(1)}%`;
    };
    const oldS = stat(() => rollOld(n, b));
    const newS = stat(() => rollNew(n, b));
    console.log(`${label.padEnd(30)} ${oldS.padEnd(26)} ${newS}`);
  }
} else {
  const OLD = MODE === 'old';
  console.log(OLD ? '【改动前】单一 boost 系数 + 「越稀有加成越小」'
    : '【当前】按档位的 rewardWeights 表（content/rarity.json）');
  console.log('档位                           出牌数  普通 / 精良 / 稀有 / 史诗        稀有+ / 史诗   平均最好那张');
  const boostOf = { normal: 0.1, elite: 0.45, boss: 0.8 };
  for (const [tier, slots] of [['normal', 3], ['elite', OLD ? 3 : 4], ['boss', 4]]) {
    const chance = tier === 'boss' ? 1 : BALANCE.cardRewardChance;
    run(tier, slots, () => (OLD ? rollOld(slots, boostOf[tier]) : rollCards(slots, 0, [], REWARD_WEIGHTS[tier])), chance);
  }
  console.log(`\n（出牌概率：普通 / 精英 ${BALANCE.cardRewardChance * 100}% · 首领 100%；`
    + '「平均最好那张」= 0 普通 / 1 精良 / 2 稀有 / 3 史诗）');
}
