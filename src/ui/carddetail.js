// 卡牌详细介绍页。
//
// 为什么要单独一个模块：它有**两个**入口 ——
//   ① 卡组一览里点一张卡（src/ui/overlays.js）；
//   ② 标题页的卡牌图鉴里点一张卡（src/ui/codex.js）。
// 图鉴要用它，而卡组页又要用图鉴那份网格（两边的排序 / 分组是同一套），
// 三者放一个文件里就会成环。所以把详情页抽到最底层，谁都能往上接。
//
// （历史上它确实住在 overlays.js 里；那里现在仍然把它转出来一份，
//   因为 tools/diag-cards.js 一直是从 overlays.js 取的。）

import { el, modal } from './dom.js';
import { cardEl, cardTag } from './cards.js';
import {
  cardDamageTotal, richHTML, resolveCardText, collectKeywords, effectLines,
} from './cardtext.js';
import { RARITY } from '../data/balance.js';
import { t } from '../core/i18n.js';
import { audio } from '../core/audio.js';

/**
 * 卡牌详细介绍页：大卡面 + 完整说明 + 效果明细 + 关键词解释。
 *
 * 起因（用户需求）：卡组页原来只有卡面本身 —— 描述被卡面宽度截断、
 * 「无视对手一半防御」「给对手 2 层灼伤」这类效果到底值多少全靠猜。
 * 这里把 effects 数据原样翻成人话，并且把文案里出现的状态词做成
 * 可以悬停查看的词条（悬停说明由 tips.js 全站统一提供）。
 *
 * @param {object} card
 * @param {{state?: () => {owned?:number}}} [opts]
 */
export function showCardDetail(card, opts = {}) {
  const { state = null } = opts;
  const rarity = RARITY[card.rarity]?.name ?? card.rarity;
  const dmg = cardDamageTotal(card);

  /**
   * 顶部那句「这张牌带了几份」。
   *
   * 这里以前还有一整套「加入 / 拿掉出战卡组」的按钮和文案，但**卡组一览早就是只读的**
   * （带进战斗的恒等于全部所持卡牌，精简只能去商店花钱删卡），
   * 所以那条分支从来没有被渲染过 —— 弹窗里留下的只有这句说明。
   * 对应地，那句文案里的「出战卡组」也早就不存在了：现在只有一个卡组。
   */
  const stateEl = el('div', { class: 'detail-deckstate' });
  const sync = () => {
    if (!state) { stateEl.textContent = ''; return; }
    const { owned = 0 } = state();
    stateEl.textContent = owned > 0
      ? t('你的卡组里有这张：{owned} 张', { owned })
      : t('这张还没拿到（去奖励 / 商店 / 事件里找找）');
  };

  // 大卡面：只是展示，所以不可交互（说明文字在下面另有一份可悬停的）
  const bigCard = cardEl(card, { size: 'lg' });
  bigCard.classList.add('card-static');

  const info = el('div', { class: 'card-detail-info' }, [
    el('div', { class: 'detail-head' }, [
      el('h2', { text: card.name }),
      el('span', { class: `detail-chip rarity-${card.rarity}`, text: rarity }),
      el('span', { class: 'detail-chip' }, [el('span', { class: 'ico-action_points', style: { width: '12px', height: '12px' } }), el('span', { text: `${card.ap} AP` })]),
      el('span', { class: 'detail-chip', text: cardTag(card) }),
      dmg ? el('span', { class: 'detail-chip', text: t('当前伤害 {dmg}', { dmg }) }) : null,
      card.exhaust ? el('span', { class: 'detail-chip', text: t('用后销毁') }) : null,
    ]),
    el('div', { class: 'detail-desc', html: richHTML(resolveCardText(card)) }),
  ]);

  // 效果明细：一行一条，把 effects 翻成人话
  const rows = effectLines(card);
  if (rows.length) {
    const box = el('div', { class: 'detail-rows' });
    for (const r of rows) {
      box.append(el('div', { class: 'detail-row' }, [
        el('span', { class: `dr-ico ${r.ico}`, style: r.ink ? { backgroundColor: r.ink } : {} }),
        el('span', { class: 'dr-label', text: r.label }),
        el('span', { class: 'dr-value', text: r.value }),
        r.note ? el('span', { class: 'dr-note', text: r.note }) : null,
      ]));
    }
    info.append(el('div', { class: 'detail-sec' }, [el('h4', { text: t('效果明细') }), box]));
  }

  // 关键词：文案里出现过的词条，悬停看用处
  const kws = collectKeywords(resolveCardText(card));
  if (kws.length) {
    const wrap = el('div', { class: 'detail-kw' });
    for (const k of kws) {
      // 颜色走 CSS 类（深色底上用亮色），不写内联
      wrap.append(el('span', {
        class: `kw ${k.cls}`,
        dataset: { tip: k.tip },
        text: k.label,
      }));
    }
    info.append(el('div', { class: 'detail-sec' }, [
      el('h4', { text: t('关键词（鼠标停上去看说明）') }),
      wrap,
    ]));
  }

  if (state) {
    info.append(el('div', { class: 'detail-actions' }, [stateEl]));
  }

  const body = el('div', { class: 'card-detail' }, [
    el('div', { class: 'card-detail-main' }, [bigCard]),
    info,
  ]);
  sync();
  audio.ui('click2');

  return modal({ title: t('卡牌详情 · {name}', { name: card.name }), wide: true, body });
}
