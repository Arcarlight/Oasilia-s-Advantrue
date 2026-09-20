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
import { CARDS } from '../data/cards.js';
import { ITEMS } from '../data/items.js';
import { EVENTS } from '../data/events.js';
import { MERCHANTS } from '../data/merchants.js';
import { ENEMIES, TIERS } from '../data/enemies.js';
import { BIOMES, RARITY, BALANCE } from '../data/balance.js';
import { NODE_TYPES } from '../data/mapgen.js';
import { STATUS_INFO } from './battle.js';
import { STAT_NAMES, STAT_SHORT, STAT_TIP, STAT_TIP_FOE } from './ui-words.js';
import { CHANGELOG } from './changelog-data.js';
import { BGM_CREDITS, BGM_LICENSES } from './bgm.js';

/**
 * 需要跟着语言走的表。
 * 键名要和 i18n.js 里的 CONTENT_FIELDS 对齐
 * （card / enemy / event / merchant / item / species / biome / rarity / status / tier / player / node）。
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
  node: NODE_TYPES,        // 地图节点：野生宝可梦 / 商队 / 营地…（名字与悬停说明）
};

/**
 * 界面上的「小词表」：它们在代码里是查表读出来的（t(STAT_NAMES[k])），静态扫不到，
 * 所以单独登记一份给 tools/build-i18n.mjs 收进待翻清单。**键和值都要收**（键如「攻」也会显示）。
 * 表本体在 src/core/ui-words.js（纯数据模块，工具 import 得起来）。
 *
 * bgmCredits / bgmLicense 也挂在这里：曲子库那两条授权说明是**生成出来的**普通对象
 * （见 tools/build-content.mjs 的 emitBgm），不登记的话切语言时没人改写它们 ——
 * 日语界面里会留一段中文（曲子库第一版就是这么漏的）。
 */
export const I18N_WORD_TABLES = {
  statName: STAT_NAMES, statShort: STAT_SHORT, statTip: STAT_TIP, statTipFoe: STAT_TIP_FOE,
  bgmCredits: Object.fromEntries(Object.entries(BGM_CREDITS).map(([id, c]) => [id, c.site])),
  bgmLicense: BGM_LICENSES,
};

/**
 * 「**列表形状**的文案」：现在只有更新日志（版本 + 日期 + 若干条）。
 *
 * 为什么单独一类：`I18N_WORD_TABLES` 是扁平的 `键→值` 小词表，而更新日志是嵌套数组；
 * 而它又跟小词表一样**静态扫 `t('…')` 扫不到**（文案是数组里的裸字符串，渲染时才过 t()）。
 * tools/build-i18n.mjs 会把这里的字符串（递归）全部收进待翻清单。
 */
export const I18N_LISTS = { changelog: CHANGELOG };

/** 把所有表的可见字段刷成当前语言；返回命中数（诊断拿它算覆盖率） */
export function refreshI18nTables() {
  return applyContentLang(I18N_TABLES);
}
