// 「哪些表要跟着语言走」——集中一处，启动时和切换语言时各刷一遍。
//
// 为什么要单独一个文件：src/core/i18n.js 不能 import 这些表（battle.js 要 import 它取 t()，
// 反过来 import 就成环了）。所以由这层把两边接起来：
//   i18n.js（纯机制） ← battle.js 等（用 t()） ← 这里（把表交给机制）
//
// 表里既有「内容」（卡牌 / 事件 / 商人 / 道具）也有「看着像数据、其实就是文案」的表
// （状态名、稀有度名、地图名、档位名）。两者一视同仁：都给 applyContentLang() 原地改写，
// 中文原文自动留副本，来回切语言不会串味。

import { applyContentLang } from './i18n.js';
import { CARDS, ITEMS } from '../data/cards.js';
import { EVENTS } from '../data/events.js';
import { MERCHANTS } from '../data/merchants.js';
import { ENEMIES, TIERS } from '../data/enemies.js';
import { BIOMES, RARITY, BALANCE } from '../data/balance.js';
import { STATUS_INFO } from './battle.js';

/**
 * 需要跟着语言走的表。
 * 键名要和 i18n.js 里的 CONTENT_FIELDS 对齐
 * （card / enemy / event / merchant / item / species / biome / rarity / status / tier / player）。
 */
export const I18N_TABLES = {
  card: CARDS,
  item: ITEMS,
  event: EVENTS,
  merchant: MERCHANTS,
  enemy: ENEMIES,          // 敌人：物种名 + 出场台词 + 属性名
  tier: TIERS,             // 野生 / 较强 / 精英 / 首领（遭遇演出的霓虹灯就是它）
  biome: BIOMES,
  rarity: RARITY,
  status: STATUS_INFO,
  player: BALANCE.player,  // 主角的名字与物种名（「欧亚西莉亚 · 沙漠蜻蜓」）
};

/** 把所有表的可见字段刷成当前语言；返回命中数（诊断拿它算覆盖率） */
export function refreshI18nTables() {
  return applyContentLang(I18N_TABLES);
}
