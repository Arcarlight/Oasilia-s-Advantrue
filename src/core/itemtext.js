// 「持有效果 / 使用效果」翻译成人话的唯一一份表。
//
// 为什么单独一个模块：同一句效果会在**三个地方**显示 —— 手持道具面板的效果汇总、
// 商人货架的悬停说明、道具图鉴。以前卡面文案就是这么散的（每处自己拼一遍），
// 结果同一件事在不同界面有不同说法。这里收成一份，谁要显示就来问。
//
// ⚠ 里面每一句都必须是**字面量的 t('…')**：多语言构建只扫得到字面量，
//   拼出来的字符串（`'攻击 +' + n`）扫不到，日语 / 英语里就会留中文。
import { t } from './i18n.js';

const pct = (x) => `${Math.round(x * 100)}%`;

/**
 * 一个持有效果说成一句人话。
 * @param {string} key hold.mods 里的 key
 * @param {{add?:number, mul?:number, flag?:boolean, n?:number}} v 汇总后的值（见 sumHeldMods）
 */
export function modLabel(key, v = {}) {
  const add = v.add ?? 0;
  const mul = v.mul ?? 1;
  switch (key) {
    case 'atk': return t('攻击 +{n}', { n: add });
    case 'def': return t('防御 +{n}', { n: add });
    case 'agi': return t('敏捷 +{n}', { n: add });
    case 'luck': return t('幸运 +{n}', { n: add });
    case 'attackPct': return t('攻击牌威力 +{p}', { p: pct(add) });
    case 'firstAttackPct': return t('每回合第一张攻击牌威力 +{p}', { p: pct(add) });
    case 'damageTakenPct': return add <= 0 ? t('受到的伤害 {p}', { p: pct(add) }) : t('受到的伤害 +{p}', { p: pct(add) });
    case 'shieldPct': return t('护盾量 +{p}', { p: pct(add) });
    case 'healPct': return t('恢复类卡牌回复量 +{p}', { p: pct(add) });
    case 'dotPct': return t('持续伤害 +{p}', { p: pct(add) });
    case 'poisonTickPct': return t('中毒每回合额外扣最大生命 {p}', { p: pct(add) });
    case 'poisonNoDecay': return t('中毒层数不会随时间减少');
    case 'poisonStacks': return t('附加中毒 / 剧毒时层数 +{n}', { n: add });
    case 'burnStacks': return t('附加灼伤时层数 +{n}', { n: add });
    case 'bleedStacksMult': return t('附加出血时层数 ×{n}', { n: mul });
    case 'debuffStacks': return t('削弱类效果层数 +{n}', { n: add });
    case 'buffTurns': return t('自身增益持续 +{n} 回合', { n: add });
    case 'apPerTurn': return t('每回合 AP +{n}', { n: add });
    case 'apFirstTurn': return t('每场战斗第一回合 AP +{n}', { n: add });
    case 'drawPerTurn': return t('每回合多抽 {n} 张牌', { n: add });
    case 'lifestealPct': return t('造成伤害时回复其 {p}', { p: pct(add) });
    case 'selfDamagePct': return t('每次打出攻击牌自损最大生命 {p}', { p: pct(add) });
    case 'surviveOnce': return t('一局一次：濒死时留下 1 点生命');
    case 'battleStartShieldPct': return t('每场战斗开始时获得最大生命 {p} 的护盾', { p: pct(add) });
    case 'battleStartCleanse': return t('每场战斗开始时清掉自身负面状态');
    case 'healPerTurnPct': return t('每回合开始回复最大生命 {p}', { p: pct(add) });
    case 'healAfterBattlePct': return t('战斗胜利后回复最大生命 {p}', { p: pct(add) });
    case 'healOnKillPct': return t('击败敌人时回复最大生命 {p}', { p: pct(add) });
    case 'goldPct': return t('获得的金币 +{p}', { p: pct(add) });
    case 'shopDiscountPct': return t('商人价格 -{p}', { p: pct(add) });
    case 'rewardChoices': return t('卡牌奖励多 {n} 个选项', { n: add });
    case 'eventHealPct': return t('事件与营地的回复量 +{p}', { p: pct(add) });
    default: return key;
  }
}

/** 一件道具的所有持有效果（一句话一条） */
export function holdLines(item) {
  return (item?.hold?.mods ?? []).map((m) => modLabel(m.key, { add: m.add, mul: m.mul, flag: !!m.flag, n: 1 }));
}

/** 一件道具的使用效果说成一句人话（`kind: 'use'` 才有） */
export function useLine(item) {
  const u = item?.use;
  if (!u) return '';
  if (u.healFull) return t('完全回复 HP');
  if (u.healPct) return t('回复最大生命的 {p}', { p: pct(u.healPct) });
  if (u.healFlat) return t('回复 {n} 点 HP', { n: u.healFlat });
  if (Array.isArray(u.cleanse)) {
    const names = u.cleanse.map((k) => t(CLEANSE_NAME[k] ?? k)).join(' / ');
    return t('清掉身上的{list}', { list: names });
  }
  if (u.stat) {
    const parts = Object.entries(u.stat).map(([k, n]) => `${t(STAT_WORD[k] ?? k)} +${n}`);
    return t('永久获得：{list}', { list: parts.join('、') });
  }
  return '';
}

/** 状态 key → 中文（和 battle.js 的 STATUS_INFO 一致，这里只用于拼「清掉哪些」） */
const CLEANSE_NAME = {
  poison: '中毒', toxic: '剧毒', burn: '灼伤', weak: '虚弱', bleed: '出血',
};
const STAT_WORD = {
  atk: '攻击', def: '防御', agi: '敏捷', luck: '幸运', maxHp: '最大生命',
};
