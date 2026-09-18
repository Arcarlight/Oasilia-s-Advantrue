// 卡面文案的富文本 + 效果明细 + 排序取值。
//
// 起因（用户需求）：卡面描述以前是一整块纯文本 ——
// 「造成 26 点伤害，并给对手 2 层灼伤」里数字、状态、关键词和正文一个颜色，
// 扫一眼抓不到重点，得逐字读完才知道哪张牌打得疼、哪张牌给什么状态。
//
// 这里做三件事：
//   richHTML()    把文案切成「数字 / 状态 / 关键词」三种高亮片段，关键词带悬停说明；
//   effectLines() 把 effects 数据翻成人类能读的明细行（卡牌详情页用）；
//   cardSort()    按伤害 / 特殊效果 / 费用 / 稀有度排序（卡组页用）。
//
// 唯一的真相仍然是 content/cards.json：文案和高亮都只是「读」它，不改写。

import { el } from './dom.js';
import { STATUS_INFO } from '../core/battle.js';

/** 文案里出现的状态词 → 引擎里的状态 key（「流血」和引擎的「出血」是同一个东西） */
const STATUS_WORD = { 中毒: 'poison', 灼伤: 'burn', 虚弱: 'weak', 出血: 'bleed', 流血: 'bleed' };

// 高亮颜色全部写在 style.css 的 .kw-xxx 里（深色界面一套亮色 / 米黄卡面一套深墨），
// 这里只管「哪个词是什么语义」，不掺颜色 —— 掺进来就会出现
// 「卡面上的深墨紫被搬到详情页的深色底上，字直接看不见」这种事。

const STAT_DESC = {
  攻击: '攻击：决定你打出多少伤害。实际伤害 =（攻击 + 招式威力）× 60 ÷ (60 + 对手防御)。',
  防御: '防御：越高越抗打，公式里它是「减伤百分比」。\n降对手防御 = 你后面每一张攻击牌都更疼。',
  敏捷: '敏捷：每回合的行动点、抽牌数、出牌上限都看它。',
  幸运: '幸运：暴击率与闪避率，暴击伤害 ×1.6。',
};
const STAT_ICO = { 攻击: 'ico-sword', 防御: 'ico-shield', 敏捷: 'ico-shoe', 幸运: 'ico-clover' };

const TIP = {
  shield: '护盾：先于 HP 承受伤害，持有者自己的回合开始时清空——所以它是「撑过这一轮」的资源。',
  shieldScale: '护盾量随**防御**成长：约等于卡面基数 + 防御 × 0.75。',
  exhaust: '销毁：打出后进销毁区，**本场战斗不会再抽到**（一场只能用一次）。',
  exhaustHand: '销毁手牌：把手里剩下的牌全部销毁。',
  discard: '弃牌：进弃牌堆，牌堆抽空时会洗净再抽回来。',
  draw: '抽牌：从卡组顶抽到手牌（卡组抽空时把弃牌堆洗回来）。',
  ap: '行动点（AP）：每回合回满，数量 = 2 + 敏捷 ÷ 2（上限 8）。打出卡牌要花 AP。',
  heal: '回复：按固定值或**最大生命**的百分比恢复 HP。百分比类的后期一样有用。',
  maxHp: '最大生命：治疗百分比、部分事件都按它算。',
  luck: '暴击与闪避都看**幸运**：暴击伤害 ×1.6，闪避直接免掉这一下。',
  recoil: '反伤：这一下打出去，自己也要吃一份固定伤害（打不死自己）。',
  cleanse: '净化：清掉自己身上所有的属性下降与负面状态（中毒 / 灼伤 / 虚弱 / 出血）。',
  pierce: '破防：这一下的伤害计算里，对手防御只按剩余比例生效。',
};

function statusTip(word) {
  const key = STATUS_WORD[word];
  const info = STATUS_INFO[key];
  if (!info) return '';
  return `${info.name}：${info.desc}\n解法：「白雾」「焕然一新」这类解状态牌能直接清掉；层数就是强度。`;
}

/**
 * 高亮规则表。用**粘性正则**（/y）从当前位置匹配，多个规则同时命中时取最长的一段 ——
 * 「无视对手一半防御」比「防御」长，所以整句会被当成一个破防关键词，而不是拦腰截一半。
 */
const RULES = [
  // 状态（连层数一起染色：读作「3 层中毒」比拆成红色 3 + 紫色中毒更好认）
  {
    src: '(?:\\d+\\s*层\\s*)?(中毒|灼伤|虚弱|出血|流血)',
    cls: (m) => `kw-status kw-${STATUS_WORD[m[1]]}`,
    tip: (m) => statusTip(m[1]),
  },
  { src: '无视对手(?:全部|一半)防御', cls: 'kw-pierce', tip: TIP.pierce },
  { src: '清除[^，。；]*?负面状态', cls: 'kw-cleanse', tip: TIP.cleanse },
  { src: '随防御成长', cls: 'kw-shield', tip: TIP.shieldScale },
  { src: '护盾', cls: 'kw-shield', tip: TIP.shield },
  { src: '销毁', cls: 'kw-exhaust', tip: TIP.exhaust },
  { src: '最大生命', cls: 'kw-heal', tip: TIP.maxHp },
  { src: '回复', cls: 'kw-heal', tip: TIP.heal },
  { src: '抽\\s*\\d+\\s*张|抽牌', cls: 'kw-draw', tip: TIP.draw },
  { src: 'AP|行动点', cls: 'kw-ap', tip: TIP.ap },
  { src: '暴击|闪避', cls: 'kw-luck', tip: TIP.luck },
  { src: '反伤', cls: 'kw-recoil', tip: TIP.recoil },
  { src: '(攻击|防御|敏捷|幸运)', cls: 'kw-stat', tip: (m) => STAT_DESC[m[1]] },
  { src: '[+\\-]?\\d+(?:\\.\\d+)?%?', cls: 'card-num', tip: null },
].map((r) => ({ ...r, re: new RegExp(r.src, 'y') }));

/** 从位置 i 起，找出最长的一条高亮规则 */
function matchAt(text, i) {
  let best = null;
  for (const r of RULES) {
    r.re.lastIndex = i;
    const m = r.re.exec(text);
    if (m && m[0].length && (!best || m[0].length > best.m[0].length)) best = { r, m };
  }
  return best;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 文案 → 高亮 HTML（数字 / 状态 / 关键词） */
export function richHTML(text) {
  if (!text) return '';
  const out = [];
  let buf = '';
  let i = 0;
  while (i < text.length) {
    const hit = matchAt(text, i);
    if (!hit) { buf += text[i]; i += 1; continue; }
    if (buf) { out.push(esc(buf)); buf = ''; }
    const { r, m } = hit;
    const cls = typeof r.cls === 'function' ? r.cls(m) : r.cls;
    const tip = typeof r.tip === 'function' ? r.tip(m) : r.tip;
    // 颜色全部交给 CSS（.kw-xxx）：同一套语义在深色界面用亮色、在羊皮纸卡面上用深墨。
    // 这里写死内联颜色的话，卡面（浅底）的深墨色会被搬到详情页（深底）上，等于看不见。
    out.push(`<span class="kw ${cls}"${tip ? ` data-tip="${esc(tip)}"` : ''}>${esc(m[0])}</span>`);
    i += m[0].length;
  }
  if (buf) out.push(esc(buf));
  return out.join('');
}

/** 卡面描述节点（用于卡牌上 / 详情页里，样式由 class 决定） */
export function cardTextEl(text, cls = 'card-text') {
  return el('div', { class: cls, html: richHTML(text) });
}

/** 这张牌的文案里出现过哪些关键词（去重）—— 详情页的「关键词」清单用 */
export function collectKeywords(text) {
  const seen = new Map();
  let i = 0;
  while (i < (text?.length ?? 0)) {
    const hit = matchAt(text, i);
    if (!hit) { i += 1; continue; }
    const { r, m } = hit;
    if (r.cls === 'card-num') { i += m[0].length; continue; }
    const tip = typeof r.tip === 'function' ? r.tip(m) : r.tip;
    const cls = typeof r.cls === 'function' ? r.cls(m) : r.cls;
    if (tip && !seen.has(m[0])) seen.set(m[0], { label: m[0], tip, cls });
    i += m[0].length;
  }
  return [...seen.values()];
}

// ============================================================
// 数值：卡面上写的伤害 / 层数
// ============================================================

/**
 * 卡面文案里的伤害数字。
 *
 * 这里**不能**拿 effects 里的 power 去乘系数：显示值和威力是两套数
 * （撞击 power 2 写 6 点，咬住 power 4 写 12 点，但龙息 power 8 写 21 点、
 * 连续 2 次造成 7 点伤害其实是 power 2 × 2 段）——
 * 显示值是按手感手调过的，只有文案本身知道它写的是多少。
 * 所以排序和明细都以文案为准，power 只作为「引擎里的威力」另说。
 */
export function damageParts(card) {
  const text = card?.text ?? '';
  const hits = Number(text.match(/连续\s*(\d+)\s*次/)?.[1] ?? 1);
  const m = text.match(/造成\s*(\d+)\s*点伤害/);
  const alt = text.match(/改为造成\s*(\d+)\s*点/);
  if (!m) return null;
  const per = Number(m[1]);
  return { per, hits, total: per * hits, alt: alt ? Number(alt[1]) : null };
}

/** 排序用的伤害总量（没有伤害的牌算 0） */
export function cardDamageTotal(card) {
  return damageParts(card)?.total ?? 0;
}

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3 };

/** 特殊效果的分类：按「这张牌除了伤害还干什么」归到一个组里（顺序 = 排序时的先后） */
const SPECIAL_GROUPS = [
  { key: 'status', label: '赋予状态（持续掉血）' },
  { key: 'weaken', label: '削弱对手' },
  { key: 'buff', label: '强化自身' },
  // 净化排在「回复与护盾」前面：白雾这类牌同时给护盾，但它的身份是「解状态」，
  // 按护盾归类会让玩家在一堆防御牌里找不到它。
  { key: 'cleanse', label: '净化与解状态' },
  { key: 'sustain', label: '回复与护盾' },
  { key: 'tempo', label: '抽牌与行动点' },
  { key: 'plain', label: '纯伤害（无附加效果）' },
];
const GROUP_INDEX = Object.fromEntries(SPECIAL_GROUPS.map((g, i) => [g.key, i]));

/** 这张牌属于哪个效果组（多个效果时取最靠前的那一类） */
export function specialGroup(card) {
  const kinds = new Set((card?.effects ?? []).map((e) => e.kind));
  const hasStatus = kinds.has('status');
  const hasWeaken = (card.effects ?? []).some((e) => e.kind === 'buff' && ((e.target === 'enemy') || (e.amount ?? 0) < 0));
  const hasBuff = (card.effects ?? []).some((e) => e.kind === 'buff' && !((e.target === 'enemy') || (e.amount ?? 0) < 0));
  if (hasStatus) return 'status';
  if (hasWeaken) return 'weaken';
  if (hasBuff) return 'buff';
  if (kinds.has('cleanse')) return 'cleanse';
  if (kinds.has('heal') || kinds.has('shield')) return 'sustain';
  if (kinds.has('draw') || kinds.has('ap')) return 'tempo';
  if (kinds.has('exhaustHand') || kinds.has('discard')) return 'tempo';
  return 'plain';
}

export const SORT_MODES = [
  { key: 'default', label: '默认', hint: '按卡组里的原始顺序（拿到手的先后）。' },
  { key: 'damage', label: '伤害', hint: '按卡面写的伤害从高到低排。' },
  { key: 'effect', label: '特殊效果', hint: '按「除了伤害还干什么」分七组：状态 / 削弱 / 强化 / 净化 / 回复护盾 / 抽牌 / 纯伤害。' },
  { key: 'ap', label: '费用', hint: '按行动点费用从低到高排。' },
  { key: 'rarity', label: '稀有度', hint: '按稀有度从高到低排。' },
];

/**
 * 排序。返回 [{card, group}]，group 只在「特殊效果」模式下有意义（用来插分组标题）。
 * 排序是稳定的：同分时保持原顺序，不会每次重画都跳来跳去。
 */
export function sortCards(cards, mode) {
  const withIdx = cards.map((card, i) => ({ card, i, group: specialGroup(card) }));
  const cmp = {
    default: () => 0,
    damage: (a, b) => cardDamageTotal(b.card) - cardDamageTotal(a.card) || (a.card.ap - b.card.ap),
    effect: (a, b) => GROUP_INDEX[a.group] - GROUP_INDEX[b.group]
      || cardDamageTotal(b.card) - cardDamageTotal(a.card),
    ap: (a, b) => a.card.ap - b.card.ap || cardDamageTotal(b.card) - cardDamageTotal(a.card),
    rarity: (a, b) => (RARITY_ORDER[b.card.rarity] ?? 0) - (RARITY_ORDER[a.card.rarity] ?? 0)
      || (a.card.ap - b.card.ap),
  }[mode] ?? (() => 0);
  return withIdx.sort((a, b) => cmp(a, b) || (a.i - b.i));
}

/** 分组标题（「特殊效果」排序时插在网格里） */
export function groupLabel(key) {
  return SPECIAL_GROUPS.find((g) => g.key === key)?.label ?? '';
}

// ============================================================
// 效果明细（详情页）
// ============================================================

const KIND_ICO = {
  shield: 'ico-shield_02',
  heal: 'ico-heal',
  draw: 'ico-cards',
  ap: 'ico-action_points',
  cleanse: 'ico-refresh',
};
const STATUS_ICO = { poison: 'ico-poison', burn: 'ico-flame', weak: 'ico-temperature_down', bleed: 'ico-heart_break_02' };
const STAT_NAME = { atk: '攻击', def: '防御', agi: '敏捷', luck: '幸运' };

/**
 * 把 effects 翻成明细行：{ ico, label, value, note? }
 * 详情页拿它渲染，玩家不用去猜「无视对手一半防御」到底减了多少。
 */
export function effectLines(card) {
  const rows = [];
  const dmg = damageParts(card);
  const fx = card?.effects ?? [];
  // 文案里只有一组伤害数字，所以只有**第一条**伤害效果能用它来描述
  let dmgUsed = false;

  for (const e of fx) {
    switch (e.kind) {
      case 'damage': {
        const useText = dmg && !dmgUsed;
        dmgUsed = true;
        const value = useText
          ? (dmg.hits > 1 ? `${dmg.per} × ${dmg.hits} 次 = ${dmg.total} 点` : `${dmg.total} 点`)
          : '按攻防结算';
        const notes = [];
        if (e.ignoreDefPct >= 1) notes.push('无视对手全部防御');
        else if (e.ignoreDefPct > 0) notes.push(`无视对手 ${Math.round(e.ignoreDefPct * 100)}% 防御`);
        if (dmg?.alt && e.execThreshold) notes.push(`对手 HP 低于 ${Math.round(e.execThreshold * 100)}% 时改为 ${dmg.alt} 点`);
        if (e.drainPct) notes.push(`回复所造成伤害的 ${Math.round(e.drainPct * 100)}%`);
        if (e.recoilPct) notes.push(`自身受到约 ${Math.round((dmg?.total ?? 0) * e.recoilPct)} 点反伤（伤害的 ${Math.round(e.recoilPct * 100)}%）`);
        rows.push({ ico: 'ico-sword', label: '伤害', value, note: notes.join('；') });
        break;
      }
      case 'status': {
        const info = STATUS_INFO[e.status];
        const chance = e.chance ? `${Math.round(e.chance * 100)}% 概率命中（对手可能抵抗）` : (info?.desc ?? '');
        rows.push({
          ico: STATUS_ICO[e.status] ?? 'ico-warn',
          label: `对手 · ${info?.name ?? e.status}`,
          value: `${e.stacks ?? 1} 层`,
          note: chance,
          // 详情页是深色底，这里用战斗界面那套亮色（STATUS_INK 是给米黄卡面压暗用的）
          ink: info?.color,
        });
        break;
      }
      case 'buff': {
        const who = e.target === 'enemy' ? '对手' : '自身';
        const down = (e.amount ?? 0) < 0;
        rows.push({
          ico: STAT_ICO[STAT_NAME[e.stat]] ?? 'ico-star',
          label: `${who} · ${STAT_NAME[e.stat] ?? e.stat}`,
          value: `${down ? '' : '+'}${e.amount}（本场战斗）`,
          note: e.target === 'enemy'
            ? (down ? '对手被削弱，你后面每一张攻击牌都更疼。' : '把对手的属性堆上去。')
            : '战斗结束就复原。',
        });
        break;
      }
      case 'shield':
        rows.push({
          ico: KIND_ICO.shield,
          label: '护盾',
          value: e.scaleWithDef ? `约 ${e.amount} + 防御 × 0.75` : `${e.amount} 点`,
          note: e.scaleWithDef ? '随防御成长，后期一样有用。' : '回合开始时清空。',
        });
        break;
      case 'heal':
        rows.push({
          ico: KIND_ICO.heal,
          label: '回复',
          value: e.pct ? `最大生命的 ${Math.round(e.pct * 100)}%` : `${e.amount} 点 HP`,
          note: e.pct ? '按最大生命算，血量越厚回得越多。' : '',
        });
        break;
      case 'draw':
        rows.push({ ico: KIND_ICO.draw, label: '抽牌', value: `${e.n} 张`, note: '卡组抽空时把弃牌堆洗回来。' });
        break;
      case 'ap':
        rows.push({ ico: KIND_ICO.ap, label: '行动点', value: `+${e.n}`, note: '可以立刻再打一张牌。' });
        break;
      case 'cleanse':
        rows.push({ ico: KIND_ICO.cleanse, label: '净化', value: '清空自身负面', note: '属性下降与中毒 / 灼伤 / 虚弱 / 出血全部清掉。' });
        break;
      case 'exhaustHand':
        rows.push({ ico: 'ico-trash', label: '销毁手牌', value: '打出时清空手牌', note: TIP.exhaustHand });
        break;
      case 'discard':
        rows.push({ ico: 'ico-shuffle', label: '弃牌', value: `${e.n ?? 1} 张`, note: TIP.discard });
        break;
      default:
        rows.push({ ico: 'ico-star', label: e.kind, value: '', note: '' });
    }
  }

  if (card?.exhaust) {
    rows.push({ ico: 'ico-trash', label: '销毁', value: '使用后进销毁区', note: '本场战斗不会再抽到，一场只能打一次。' });
  }
  return rows;
}
