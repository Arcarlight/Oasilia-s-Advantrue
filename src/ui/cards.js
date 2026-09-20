// 卡牌渲染：把 CARDS 数据变成可点的一张卡。卡面美术复用工作区的粒子/图标素材。

import { el } from './dom.js';
import { t } from '../core/i18n.js';
import { audio } from '../core/audio.js';
import { BALANCE, RARITY } from '../data/balance.js';
import { cardTextEl, richHTML, resolveCardText, cardTextContext, expertStats } from './cardtext.js';
import { expertEnabled } from '../core/expert.js';
// 卡牌美术（图标 mask 类名 + 背景特效图）的唯一数据源是 content/cards.json 的 ico/fx：
// build-content.mjs 把它生成成 src/data/cards.js 的 CARD_ART。这里以前手抄了一份，
// 于是「改了 content/cards.json 却看不到界面变化」——现在直接吃生成的那份，一份都不留。
import { CARD_ART } from '../data/cards.js';

export { CARD_ART };

/**
 * 卡牌的类型标签（攻击 / 攻守 / 回复 / 变化 …），详情页也用它
 */
export function cardTag(card) {
  const kinds = new Set(card.effects.map((e) => e.kind));
  if (kinds.has('damage') && (kinds.has('shield') || kinds.has('heal'))) return t('攻守');
  if (kinds.has('damage')) return t('攻击');
  if (kinds.has('heal')) return t('回复');
  if (kinds.has('shield')) return t('防御');
  if (kinds.has('buff') || kinds.has('status')) return t('变化');
  if (kinds.has('draw') || kinds.has('ap')) return t('辅助');
  return t('技能');
}

/**
 * 卡牌的「角色」标记：这张牌除了打伤害，还担什么职责。
 *
 * 起因（用户需求）：手牌里一眼分不出「哪张是保命的」「哪张用了要付代价」，
 * 只能一张张读描述 —— 尤其是新卡池变厚之后，扫牌的成本明显上来了。
 *
 * 判断全部**从 effects 推**，不手写一张清单：
 *   保护 = 给护盾 / 回血（含吸血）/ 加防御 / 解负面
 *   代价 = 自伤 / 反伤 / 本场削弱自己
 * 这样以后加新卡只要 effect 写对，标记就自动对了。
 */
export function cardRoles(card) {
  const fx = card?.effects ?? [];
  const self = (e) => e.target !== 'enemy';
  const gainsShield = fx.some((e) => e.kind === 'shield');
  const heals = fx.some((e) => e.kind === 'heal' || (e.kind === 'damage' && (e.drainPct ?? 0) > 0));
  const raisesDef = fx.some((e) => e.kind === 'buff' && self(e) && e.stat === 'def' && ((e.amount ?? 0) > 0 || (e.pct ?? 0) > 0));
  const cleanses = fx.some((e) => e.kind === 'cleanse');
  const selfHurt = fx.some((e) => e.kind === 'selfDmg' || (e.kind === 'damage' && (e.recoilPct ?? 0) > 0));
  const selfWeak = fx.some((e) => e.kind === 'buff' && self(e) && ((e.amount ?? 0) < 0 || (e.pct ?? 0) < 0));
  /** 削弱对手也算一种「负面特性」，放在美术角标里（和抽牌 / 销毁同一排） */
  const weakensFoe = fx.some((e) => (e.kind === 'buff' && e.target === 'enemy' && ((e.amount ?? 0) < 0 || (e.pct ?? 0) < 0))
    || (e.kind === 'status' && e.target !== 'self'));
  /**
   * 「强化自己」：本场战斗里自己的属性提升（健美 / 龙之舞 / 聚气 / 剑舞…）。
   * 角标用**红色的上箭头**，和「削弱对手」的紫色下箭头成一对（用户要求）。
   */
  const buffsSelf = fx.some((e) => e.kind === 'buff' && self(e) && ((e.amount ?? 0) > 0 || (e.pct ?? 0) > 0));

  const roles = [];
  const detail = (bits) => bits.filter(Boolean).join('\n');
  if (selfHurt || selfWeak) {
    roles.push({
      key: 'cost',
      ico: 'ico-heart_break_02',
      label: t('代价'),
      tip: `${t('代价：这张牌会让你自己付出点什么。')}\n${detail([
        selfHurt ? t('· 自身受伤（反伤 / 自伤）') : null,
        selfWeak ? t('· 本场战斗削弱自己') : null,
      ])}\n${t('打之前先算一下值不值。')}`,
    });
  }
  if (gainsShield || heals || raisesDef || cleanses) {
    roles.push({
      key: 'protect',
      ico: 'ico-protect',
      label: t('保护'),
      tip: `${t('保护：保命的那一类。')}\n${detail([
        gainsShield ? t('· 获得护盾') : null,
        heals ? t('· 回复生命（含吸血）') : null,
        raisesDef ? t('· 提升自己的防御') : null,
        cleanses ? t('· 清除自身负面') : null,
      ])}`,
    });
  }
  // 最多挂两个：卡面底栏就那么宽，三个标记会挤掉类型标签
  return { roles: roles.slice(0, 2), weakensFoe };
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
      // 注意：这里以前在 md（战斗手牌）尺寸下会额外挂一个 `card-common`，
      // 于是战斗里的稀有牌同时带着 card-common 和 card-rare 两个类 ——
      // 谁的样式赢全靠 CSS 里的书写顺序。稀有度配色改成「按类改变量」之后这层歧义必须去掉。
      'card', size === 'sm' ? 'card-sm' : size === 'lg' ? 'card-lg' : '', `card-${card.rarity}`,
      disabled ? 'disabled' : '', selected ? 'selected' : '',
      check && checked ? 'in-deck' : '',
      // 左上角有勾选圈时把卡名让开：以前圆圈直接压在名字的第一个字上
      check ? 'card-with-check' : '',
      card.exhaust ? 'card-exhaust' : '',
    ].filter(Boolean).join(' '),
    role: 'button',
    tabindex: opts.tabIndex ?? 0,
    'aria-label': t('{name}，消耗 {ap} AP：{text}', { name: card.name, ap, text: resolveCardText(card) }),
    'aria-disabled': disabled ? 'true' : 'false',
  });

  node.append(el('div', { class: 'card-band' }));
  node.append(el('div', { class: 'card-top' }, [
    el('div', { class: 'card-name', text: card.name }),
    el('div', { class: 'card-ap', text: String(ap), title: t('{ap} 点行动点', { ap }) }),
  ]));

  const artBox = el('div', { class: 'card-art' }, [
    el('div', { class: 'art-fx', style: { backgroundImage: `url(assets/img/fx/${art.fx}.png)` } }),
    el('span', { class: `art-ico ${art.ico}` }),
  ]);
  if (dmgText) {
    artBox.append(el('div', {
      class: 'card-dmg-badge',
      text: dmgText,
      title: t('按当前攻防估算的伤害'),
      style: {
        position: 'absolute', right: '5px', bottom: '5px',
        padding: '1px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: '800',
        background: 'rgba(120,40,20,.85)', color: '#ffd9c9',
      },
    }));
  }
  const roles = cardRoles(card);

  // 特殊动作角标（素材来自 Kenney 的棋盘图标包 + Game-Icon-Pack）：一眼看出这张牌除了数值还干什么。
  // 「抽牌 / 销毁 / 弃牌 / 削弱对手」这些以前只写在描述文字里，扫一眼牌面根本看不出来。
  // 角标贴在美术横幅的左下角（以前它自己占一整行，卡面本来就不高，白吃掉一行文字的空间）。
  const acts = [];
  const act = (has, cls, tip) => { if (has) acts.push(el('span', { class: `card-act ${cls}`, dataset: { tip } })); };
  act(card.effects.some((e) => e.kind === 'draw'), 'ico-cards', t('抽牌：从牌堆再抽一张。'));
  // 削弱 / 增益用**染色的上下箭头**（紫下箭头 / 红上箭头），不再用温度计 ——
  // 温度计要停下来想一下「升的是谁」，箭头看一眼就懂（用户要求）。
  act(roles.weakensFoe, 'ico-arrow_down_blue', t('削弱对手：降它的属性 / 挂负面状态 —— 你后面每一张牌都更疼。'));
  act(roles.buffsSelf, 'ico-arrow_up_red', t('强化自己：本场战斗里自己的属性提升。'));
  act(card.exhaust, 'ico-trash', t('销毁：打出后进入销毁区，本场战斗不会再出现。'));
  act(card.effects.some((e) => e.kind === 'exhaustHand'), 'ico-trash', t('销毁手牌：把手里剩下的牌全部销毁。'));
  act(card.effects.some((e) => e.kind === 'discard'), 'ico-shuffle', t('弃牌：把牌弃进弃牌堆（牌堆抽空时会洗回来）。'));
  if (acts.length) artBox.append(el('div', { class: 'card-acts' }, acts));

  node.append(el('div', { class: 'card-mid' }, [
    artBox,
    // 描述走富文本：数字 / 状态 / 关键词分别染色（见 cardtext.js），
    // 以前是一整块同色纯文本，扫一眼看不出哪张牌打得疼、给什么状态。
    cardTextEl(card),
  ]));

  /**
   * 专家模式：把这张牌背后的数字直接标在卡面上（用户在设置里开，默认关）。
   * 放的是**算出来的**值（当前攻防下的伤害 / 护盾），不是文案里的占位数字 ——
   * 描述里那句「造成 13 点伤害」是同一份推导，所以两边不会打架。
   */
  if (expertEnabled()) {
    const s = expertStats(card);
    const chips = [];
    const add = (label, tip) => chips.push(el('span', { class: 'card-expert-chip', dataset: { tip } }, [label]));
    if (s.power > 0) add(t('威力 {n}%', { n: s.power }), t('卡面印的威力（攻击力百分比），和你的属性无关。'));
    if (s.damage > 0) {
      add(s.hits > 1 ? t('伤害 {per}×{hits}={total}', { per: s.per, hits: s.hits, total: s.damage }) : t('伤害 {n}', { n: s.damage }),
        t('按当前攻击 {atk} 与对手防御 {def} 结算出来的实际伤害。\n伤害 = 攻击 × 威力% × {K} ÷ ({K} + 对手防御)。', { atk: cardTextContext().atk, def: cardTextContext().def, K: BALANCE.armorK }));
    }
    if (s.shield > 0) {
      add(t('护盾 {n}', { n: s.shield }),
        t('实际护盾（吃你自己的防御 {def}）：{formula}', { def: s.selfDef, formula: t('基数 × (1 + 防御 ÷ 12)') }));
    }
    if (s.draw > 0) add(t('抽牌 {n}', { n: s.draw }), t('打出后额外抽几张。'));
    if (s.ap > 0) add(t('回 AP {n}', { n: s.ap }), t('打出后返还的行动点。'));
    if (s.stacks > 0) add(t('状态 {n} 层', { n: s.stacks }), t('这张牌给对手（或自己）挂上的状态层数合计。'));
    if (s.damage > 0 && s.cost > 0) add(t('每 AP {n}', { n: s.perAp }), t('每 1 点行动点打出多少伤害 —— 比较两张牌贵不贵看这个。'));
    if (chips.length) node.classList.add('expert');
    if (chips.length) node.append(el('div', { class: 'card-expert' }, chips));
  }

  /**
   * 底栏：左边「稀有度宝石 + 类型 + 角色标记」，右边是调用方给的角标（×N / 未获得 …）。
   *
   * 稀有度以前只有顶上那条 4px 的色带，玩家反馈「略微看不出来」——
   * 现在色带之外还有：整张卡面的色调（见 style.css 的 --rarity-wash）、
   * 描边颜色、卡名颜色，再加这颗宝石（悬停会说出稀有度叫什么）。
   */
  const footLeft = el('span', { class: 'foot-left' }, [
    el('span', { class: 'rarity-gem', dataset: { tip: t('稀有度：{rarity}\n卡面配色、描边、卡名颜色都跟着稀有度走。', { rarity: rarityLabel(card) || card.rarity }) } }),
    el('span', { class: 'card-tag', text: cardTag(card) }),
  ]);
  for (const r of roles.roles) {
    footLeft.append(el('span', { class: `card-role role-${r.key}`, dataset: { tip: r.tip } }, [
      el('span', { class: r.ico }), r.label,
    ]));
  }
  const footRight = el('span', { class: 'foot-right' });
  // 角标统一带 .card-badge：诊断脚本按这个类精确取（底栏现在有左右两个分组，
  // 只按「.card-foot 里的 span」找会先命中分组容器，读数就是错的）
  for (const b of badges) footRight.append(el('span', { class: 'card-badge', text: b }));
  node.append(el('div', { class: 'card-foot' }, [footLeft, footRight]));

  if (check) {
    /**
     * 左上角那个「已入选」圆圈。
     *
     * 注意：它现在**没有任何调用方**会打开（`check` 只有卡面布局诊断当检具用），
     * 因为「出战卡组」这个概念已经取消 —— 带进战斗的恒等于全部所持卡牌，
     * 卡组页是只读的。所以这里不再挂「加进 / 拿出战卡组」那套文案：
     * 那是一句玩家看不到、又和现在的规则自相矛盾的话。
     * 圆圈本身留着是给诊断量「带圆圈时卡名的排版余量」当最坏情况的。
     */
    const box = el(onCheck ? 'button' : 'div', {
      class: 'card-check',
      type: onCheck ? 'button' : null,
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
