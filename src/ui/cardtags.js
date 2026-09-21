// 卡牌的**流派标签**：图标 + 名字 + 一句说明（详情页显示，门禁按它查「每档稀有度都有牌」）。
//
// 为什么单独一个叶子模块：详情页（carddetail）与图鉴（codex）都要用它，
// 而这两个模块互相不认识 —— 放在任何一边都会变成「另一个去 import 它」的隐式依赖。
//
// ⚠ 名字与说明都用**字面量 t('…')**（构建多语言表时只扫得到字面量）；
//   `key` 必须和 content/cards.json 里的 `tags` 值一一对应，check-content 会对账。
import { t } from '../core/i18n.js';

export const CARD_TAG_INFO = {
  poison: {
    ico: 'ico-poison', color: '#c9a3ff',
    label: () => t('毒流'),
    desc: () => t('围绕中毒 / 剧毒层数：先铺层、再翻倍或引爆。'),
  },
  bleed: {
    ico: 'ico-heart_break_02', color: '#ff8a8a',
    label: () => t('出血流'),
    desc: () => t('围绕出血层数：每打中一次就多掉一截血。'),
  },
  burst: {
    ico: 'ico-sword', color: '#ffb46a',
    label: () => t('单次高伤'),
    desc: () => t('堆威力（力量 / 强化）之后一张牌打穿对手。'),
  },
  weaken: {
    ico: 'ico-temperature_down', color: '#9fd6ff',
    label: () => t('削弱流'),
    desc: () => t('先把对手的攻击 / 防御削下来，再用「对手每损失 1 点防御威力更高」这类牌收尾。'),
  },
  buff: {
    ico: 'ico-arrow_up_red', color: '#ffd27a',
    label: () => t('强化流'),
    desc: () => t('给自己挂带回合数的强化（行动点上限 / 回响 / 威力 / 附加层数）。'),
  },
  timing: {
    ico: 'ico-clock', color: '#8ce0c0',
    label: () => t('蓄势流'),
    desc: () => t('下回合生效、或再打出 N 张牌后生效 —— 先埋一手，到点一起结算。'),
  },
};

/** 一张牌身上的流派标签（过滤掉不认识的值，旧存档里可能有拼错的） */
export function cardTags(card) {
  return (card?.tags ?? []).map((k) => CARD_TAG_INFO[k]).filter(Boolean);
}
