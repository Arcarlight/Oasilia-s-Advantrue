// Rescale the moves that feed the per-type enemy kits so their damage matches the
// **existing pool profile**（用户要求：现在的平衡就是标准）。
//
// 为什么要动威力：新写的本系招式是按「费用-威力曲线」配的，而那条曲线比现有敌人池**高一大截** ——
// 现有低档池子（8 张牌、6 张攻击、平均费 1.0）的平均威力只有 ~105，按曲线配出来的新池子平均 150+。
// 直接上线等于把杂兵的输出抬四成。所以这里按费用分档，把「属性招式」统一压到目标区间：
//
//   0 费 25~35 / 1 费 70~105 / 2 费 130~190 / 3 费 220~310（平均约 100 / 165）
//
// 只动 tools/kit-cards.json 里登记的那些卡（= 属性池用到的攻击牌），玩家起始卡组与
// 老卡一张都不碰。改完用 `node tools/measure-kit-profile.mjs` 与
// `node tools/measure-balance.mjs` 对账（胜率要落在基线 ±10 个百分点内）。
//
// Usage: node tools/rescale-kit-cards.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const CARDS = path.join(ROOT, 'content', 'cards.json');

/** 费用 -> 目标「总威力」（多段牌是每一下的威力 × 段数）。
 *  这组数让整套属性池的 **每 AP 伤害** 落在现有池子的中位数（≈93）上，
 *  而不是只对「平均威力」——敌人每回合能花多少 AP 是固定的，那才是真正决定难度的量。 */
export const POWER_TARGET = { 0: 30, 1: 85, 2: 160, 3: 235 };

const data = JSON.parse(fs.readFileSync(CARDS, 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'kit-cards.json'), 'utf8'));

const changes = [];
for (const card of data.cards) {
  if (!plan.cards.includes(card.id)) continue;
  const dmg = (card.effects ?? []).filter((e) => e.kind === 'damage');
  if (!dmg.length) continue;
  const target = POWER_TARGET[card.ap];
  if (target == null) continue;
  const hits = dmg.reduce((s, e) => s + (e.hits ?? 1), 0);
  // 多段牌按「每一下 = 目标 ÷ 段数」，不额外加个体差 ——
  // 之前那个 `power % 7` 的小扰动会让每段的威力上下浮动，段数一多就把整张牌的总威力抬上去
  // （实测平均威力因此比目标高 20），「平均威力」是余额口径，不能这么飘。
  const per = Math.max(1, Math.round(target / hits / 5) * 5);
  let changed = false;
  for (const e of dmg) {
    const next = per;
    if (e.power !== next) { e.power = next; changed = true; }
  }
  if (changed) changes.push({ id: card.id, ap: card.ap, to: dmg.map((e) => `${e.power}${e.hits ? 'x' + e.hits : ''}`).join('+') });
}

console.log(`目标威力: 0费 ${POWER_TARGET[0]} / 1费 ${POWER_TARGET[1]} / 2费 ${POWER_TARGET[2]} / 3费 ${POWER_TARGET[3]}`);
console.log(`属性招式 ${plan.cards.length} 张里，改动 ${changes.length} 张`);
for (const c of changes.slice(0, 12)) console.log(`  ${c.id.padEnd(20)} ap${c.ap} -> ${c.to}`);
if (changes.length > 12) console.log(`  ...（还有 ${changes.length - 12} 张）`);
if (!CHECK) {
  fs.writeFileSync(CARDS, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('written: content/cards.json');
}
