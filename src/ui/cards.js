// 卡牌渲染：把 CARDS 数据变成可点的一张卡。卡面美术复用工作区的粒子/图标素材。

import { el } from './dom.js';
import { audio } from '../core/audio.js';
import { RARITY } from '../data/balance.js';
import { cardTextEl, richHTML, resolveCardText } from './cardtext.js';
// 卡牌美术（图标 mask 类名 + 背景特效图）的唯一数据源是 content/cards.json 的 ico/fx：
// build-content.mjs 把它生成成 src/data/cards.js 的 CARD_ART。这里以前手抄了一份，
// 于是「改了 content/cards.json 却看不到界面变化」——现在直接吃生成的那份，一份都不留。
import { CARD_ART } from '../data/cards.js';

export { CARD_ART };

/** 卡牌的类型标签（攻击 / 攻守 / 回复 / 变化 …），详情页也用它 */
export function cardTag(card) {
  const kinds = new Set(card.effects.map((e) => e.kind));
  if (kinds.has('damage') && (kinds.has('shield') || kinds.has('heal'))) return '攻守';
  if (kinds.has('damage')) return '攻击';
  if (kinds.has('heal')) return '回复';
  if (kinds.has('shield')) return '防御';
  if (kinds.has('buff') || kinds.has('status')) return '变化';
  if (kinds.has('draw') || kinds.has('ap')) return '辅助';
  return '技能';
}

/**
 * 生成一张卡牌 DOM。
 * @param {object} card CARDS 里的一项
 * @param {{size?:'sm'|'md'|'lg', disabled?:boolean, selected?:boolean, onClick?:Function,
 *          onClickDisabled?:boolean, check?:boolean, checked?:boolean, dmgText?:string,
 *          cost?:number, badges?:string[], tabIndex?:number}} opts
 */
export function cardEl(card, opts = {}) {
  const {
    size = 'md', disabled = false, selected = false, onClick, onClickDisabled = false,
    check = false, checked = false, dmgText = null, cost = null, badges = [], onCheck = null,
    // 灰卡片被点时的回调：给玩家一句「为什么打不出去」（不传就是老行为：直接吞掉点击）
    onDisabledClick = null,
  } = opts;

  const art = CARD_ART[card.id] ?? { ico: 'ico-star', fx: 'magic_1' };
  const ap = cost ?? card.ap;

  const node = el('div', {
    class: [
      'card', `card-${size === 'md' ? 'common' : card.rarity}`, `card-${card.rarity}`,
      size === 'sm' ? 'card-sm' : size === 'lg' ? 'card-lg' : '',
      disabled ? 'disabled' : '', selected ? 'selected' : '',
      check && checked ? 'in-deck' : '',
      // 左上角有勾选圈时把卡名让开：以前圆圈直接压在名字的第一个字上
      check ? 'card-with-check' : '',
      card.exhaust ? 'card-exhaust' : '',
    ].filter(Boolean).join(' '),
    role: 'button',
    tabindex: opts.tabIndex ?? 0,
    'aria-label': `${card.name}，消耗 ${ap} AP：${resolveCardText(card)}`,
    'aria-disabled': disabled ? 'true' : 'false',
  });

  node.append(el('div', { class: 'card-band' }));
  node.append(el('div', { class: 'card-top' }, [
    el('div', { class: 'card-name', text: card.name }),
    el('div', { class: 'card-ap', text: String(ap), title: `${ap} 点行动点` }),
  ]));

  const artBox = el('div', { class: 'card-art' }, [
    el('div', { class: 'art-fx', style: { backgroundImage: `url(assets/img/fx/${art.fx}.png)` } }),
    el('span', { class: `art-ico ${art.ico}` }),
  ]);
  if (dmgText) {
    artBox.append(el('div', {
      class: 'card-dmg-badge',
      text: dmgText,
      title: '按当前攻防估算的伤害',
      style: {
        position: 'absolute', right: '5px', bottom: '5px',
        padding: '1px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: '800',
        background: 'rgba(120,40,20,.85)', color: '#ffd9c9',
      },
    }));
  }
  // 特殊动作角标（素材来自 Kenney 的棋盘图标包）：一眼看出这张牌除了数值还干什么。
  // 「抽牌 / 销毁 / 弃牌」这些以前只写在描述文字里，扫一眼牌面根本看不出来。
  // 角标贴在美术横幅的左下角（以前它自己占一整行，卡面本来就不高，白吃掉一行文字的空间）。
  const acts = [];
  const act = (has, cls, tip) => { if (has) acts.push(el('span', { class: `card-act ${cls}`, dataset: { tip } })); };
  act(card.effects.some((e) => e.kind === 'draw'), 'ico-cards', '抽牌：从牌堆再抽一张。');
  act(card.exhaust, 'ico-trash', '销毁：打出后进入销毁区，本场战斗不会再出现。');
  act(card.effects.some((e) => e.kind === 'exhaustHand'), 'ico-trash', '销毁手牌：把手里剩下的牌全部销毁。');
  act(card.effects.some((e) => e.kind === 'discard'), 'ico-shuffle', '弃牌：把牌弃进弃牌堆（牌堆抽空时会洗回来）。');
  if (acts.length) artBox.append(el('div', { class: 'card-acts' }, acts));

  node.append(el('div', { class: 'card-mid' }, [
    artBox,
    // 描述走富文本：数字 / 状态 / 关键词分别染色（见 cardtext.js），
    // 以前是一整块同色纯文本，扫一眼看不出哪张牌打得疼、给什么状态。
    cardTextEl(card),
  ]));

  const foot = [el('span', { text: cardTag(card) })];
  for (const b of badges) foot.push(el('span', { text: b }));
  node.append(el('div', { class: 'card-foot' }, foot));

  if (check) {
    // 左上角那个「已入选」圆圈本身也是按钮：卡面整体改成了「点开详情」，
    // 所以勾选出战必须有自己独立的点击区（不然想加张牌还得先进详情页）。
    const box = el(onCheck ? 'button' : 'div', {
      class: 'card-check',
      type: onCheck ? 'button' : null,
      dataset: onCheck ? { tip: checked ? '点一下：从出战卡组里拿掉。' : '点一下：加进出战卡组。' } : null,
      'aria-label': checked ? '从出战卡组移出' : '加入出战卡组',
    }, [el('span', { class: 'ico-check', style: { width: '12px', height: '12px' } })]);
    if (onCheck) {
      box.addEventListener('click', (e) => {
        e.stopPropagation();
        onCheck(card, node);
      });
    }
    node.append(box);
  }

  if (!disabled || onClickDisabled || onDisabledClick) {
    const blocked = () => {
      if (disabled && !onClickDisabled) {
        // 卡片是灰的也别默默吞掉点击 —— 让调用方给一句「为什么打不出去」
        onDisabledClick?.(card, node);
        return true;
      }
      return false;
    };
    node.addEventListener('click', () => {
      if (blocked()) return;
      onClick?.(card, node);
    });
    node.addEventListener('keydown', (e) => {
      // 焦点在左上角那个勾选圈上时不要当成「按了整张卡」：
      // 否则用键盘回车勾选，会顺手把详情页也开出来。
      if (e.target?.closest?.('.card-check')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (blocked()) return;
        onClick?.(card, node);
      }
    });
    node.addEventListener('mouseenter', () => { if (!disabled) audio.ui('hover'); });
  }
  return node;
}

/** 小尺寸的卡牌名条（用于卡组列表的紧凑显示） */
export function cardRow(card, opts = {}) {
  const art = CARD_ART[card.id] ?? { ico: 'ico-star' };
  return el('div', {
    class: 'shop-item', style: { flexDirection: 'row', alignItems: 'center', gap: '10px' },
  }, [
    el('span', { class: `art-ico ${art.ico}`, style: { width: '28px', height: '28px', color: '#4a3524' } }),
    el('div', { style: { flex: '1 1 auto' } }, [
      el('h4', { text: `${card.name}  ·  ${card.ap} AP`, style: { fontSize: '14px' } }),
      // 商店行里也一样高亮：数字 / 状态一眼能挑出来
      el('p', { html: richHTML(resolveCardText(card)), style: { minHeight: 'auto' } }),
    ]),
    opts.trailing ?? null,
  ]);
}

export function rarityLabel(card) {
  return RARITY[card.rarity]?.name ?? '';
}
