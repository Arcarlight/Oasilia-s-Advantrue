// 卡面文案的富文本 + 效果明细 + 排序取值。
//
// 起因（用户需求）：卡面描述以前是一整块纯文本 ——
// 「造成 26 点伤害，并给对手 2 层灼伤」里数字、状态、关键词和正文一个颜色，
// 扫一眼抓不到重点，得逐字读完才知道哪张牌打得疼、哪张牌给什么状态。
//
// 这里做三件事：
//   richHTML()    把文案切成「数字 / 状态 / 关键词」三种高亮片段，关键词带悬停说明；
//   effectLines() 把 effects 数据翻成人类能读的明细行（卡牌详情页用）；
//   cardSort()    按威力 / 特殊效果 / 费用 / 稀有度排序（卡组页用）。
//
// 唯一的真相仍然是 content/cards.json：文案和高亮都只是「读」它，不改写。

import { el } from './dom.js';
import { STATUS_INFO, computeHit } from '../core/battle.js';
import { BALANCE } from '../data/balance.js';

/** 文案里出现的状态词 → 引擎里的状态 key（「流血」和引擎的「出血」是同一个东西） */
const STATUS_WORD = { 中毒: 'poison', 剧毒: 'toxic', 灼伤: 'burn', 虚弱: 'weak', 出血: 'bleed', 流血: 'bleed' };

// ============================================================
// 卡面数字：从「印死的数字」改成「按当前攻防实时算」
// ============================================================
/**
 * 伤害公式改成「威力 × 攻击力」之后（见 computeHit），一张牌打多少**取决于玩家的攻击力**，
 * 卡面上印死的「造成 6 点伤害」从第 2 章起就是错的。
 *
 * 所以 content/cards.json 的文案里伤害写成 `{d}`（第一条伤害效果）与 `{d2}`（斩杀分支），
 * 由这里按当前上下文算出来。上下文 = 玩家攻击力 + 参照防御：
 *   · 战斗中是**当前那只敌人**的防御（最准）
 *   · 战斗外是**本章典型敌人**的防御（估算，卡面上标了「约」）
 * 全站只有这一份推导，卡面 / 详情 / 商店 / 排序读的都是它。
 */
const CTX = { atk: BALANCE.player.atk, def: 0 };

/** 设置卡面伤害的估算上下文（UI 每次渲染前刷新一次） */
export function setCardTextContext(ctx = {}) {
  if (Number.isFinite(ctx.atk)) CTX.atk = ctx.atk;
  if (Number.isFinite(ctx.def)) CTX.def = ctx.def;
}
export function cardTextContext() { return { ...CTX }; }

/**
 * 一条伤害效果在给定上下文下打出的数字。
 * 直接调引擎的 computeHit，而不是在这儿再抄一遍公式 ——
 * 抄一遍就会出现「卡面写 12、打出来 9」这类对不上的老问题。
 */
export function damageAt(power, opts = {}) {
  return computeHit(
    { atk: opts.atk ?? CTX.atk, atkMod: 0, weak: 0, strength: opts.strength ?? 0 },
    { def: opts.def ?? CTX.def, defMod: 0, bleed: 0 },
    power,
    { ignoreDefPct: opts.ignoreDefPct ?? 0 },
  );
}

/** 卡面文案里的 {d} / {d2} 换成实际伤害数字 */
export function resolveCardText(card, ctx = {}) {
  const text = typeof card === 'string' ? card : (card?.text ?? '');
  if (!text.includes('{d')) return text;
  const effs = (typeof card === 'string' ? [] : (card.effects ?? [])).filter((e) => e.kind === 'damage');
  if (!effs.length) return text.replace(/\{d2?\}/g, '—');
  const at = (e, bonus = 0) => damageAt(e.power + bonus, { ...ctx, ignoreDefPct: e.ignoreDefPct ?? 0 });
  const main = effs[0];
  const exec = effs.find((e) => e.execThreshold != null);
  const d = at(main);
  const d2 = exec ? at(exec, exec.execBonus ?? 0) : d;
  return text.replace(/\{d\}/g, String(d)).replace(/\{d2\}/g, String(d2));
}

// 高亮颜色全部写在 style.css 的 .kw-xxx 里（深色界面一套亮色 / 米黄卡面一套深墨），
// 这里只管「哪个词是什么语义」，不掺颜色 —— 掺进来就会出现
// 「卡面上的深墨紫被搬到详情页的深色底上，字直接看不见」这种事。

const STAT_DESC = {
  攻击: '攻击：决定你打出多少伤害。实际伤害 = 攻击 × 招式威力% × 40 ÷ (40 + 对手防御)。\n所以「攻击 +4」等于后面每一张牌都按比例更疼，越到后期越值钱。',
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
  draw: '抽牌：从卡组顶抽到手牌。\n打出去的牌会进**弃牌区**，牌堆抽空、还要再抽的时候，弃牌区才会洗回牌堆。所以牌组薄的时候，同一张牌一轮里能被打上好几次 —— 但每回合的出牌次数是有限的。',
  ap: '行动点（AP）：每回合回满，数量 = 2 + 敏捷 ÷ 2（上限 8）。打出卡牌要花 AP。',
  heal: '回复：按固定值或**最大生命**的百分比恢复 HP。百分比类的后期一样有用。',
  maxHp: '最大生命：治疗百分比、中毒 / 灼伤这些持续伤害都按它算。',
  luck: '暴击与闪避都看**幸运**：暴击伤害 ×1.6，闪避直接免掉这一下。',
  recoil: '反伤：这一下打出去，自己也要吃一份固定伤害（打不死自己）。',
  cleanse: '净化：清掉自己身上所有的属性下降与负面状态（中毒 / 剧毒 / 灼伤 / 虚弱 / 出血）。',
  pierce: '破防：这一下的伤害计算里，对手防御只按剩余比例生效。',
  cost: '费用买的是威力：**威力是攻击力的百分比**（威力 110 = 打出 1.1 倍攻击）。\n每点 AP 买到的威力随费用上升，所以「把 AP 花在贵牌上」永远比连打 0 费牌划算。',
  strength: '力量：不改属性面板，直接给**每一次攻击**的威力加一个百分比。\n和攻击力的区别是它不会被「攻击 -N」之类的削弱吃掉。',
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
    src: '(?:\\d+\\s*层\\s*)?(中毒|剧毒|灼伤|虚弱|出血|流血)',
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
  { src: '威力', cls: 'kw-ap', tip: TIP.cost },
  { src: '力量', cls: 'kw-stat', tip: TIP.strength },
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
export function cardTextEl(card, cls = 'card-text') {
  return el('div', { class: cls, html: richHTML(typeof card === 'string' ? card : resolveCardText(card)) });
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
 * 卡面的伤害数字：**从 effects 推**，不再去文案里正则抠数字。
 *
 * 以前这里是 `text.match(/造成\s*(\d+)\s*点伤害/)`：显示值和引擎威力是两套数，
 * 电脑上写「造成 6 点」而引擎里是 power 2 —— 一旦有人改了其中一边，
 * 排序、角标、详情页三处会一起变成错的，而且没人发现。
 * 现在唯一的真相是 effects + 当前的攻防上下文。
 */
export function damageParts(card, ctx = {}) {
  const effs = (card?.effects ?? []).filter((e) => e.kind === 'damage');
  if (!effs.length) return null;
  const main = effs[0];
  const per = damageAt(main.power, { ...ctx, ignoreDefPct: main.ignoreDefPct ?? 0 });
  const hits = main.hits ?? 1;
  const exec = effs.find((e) => e.execThreshold != null);
  const alt = exec
    ? damageAt(exec.power + (exec.execBonus ?? 0), { ...ctx, ignoreDefPct: exec.ignoreDefPct ?? 0 })
    : null;
  return { per, hits, total: per * hits, alt };
}

/**
 * 排序 / 角标用的「威力总量」（攻击力百分比，与玩家当前属性无关）。
 *
 * 排序刻意不用实际伤害：实际伤害会随玩家攻击力变，同一副卡组在两个人屏幕上
 * 顺序不一样；而「哪张牌威力高」是卡牌自身的属性，用威力总量排才稳定。
 */
export function cardPowerTotal(card) {
  return (card?.effects ?? [])
    .filter((e) => e.kind === 'damage')
    .reduce((s, e) => s + (e.power + (e.execBonus ?? 0) / 2) * (e.hits ?? 1), 0);
}

/** 当前上下文下这一张牌大概打多少（详情页 / 卡面角标用） */
export function cardDamageTotal(card, ctx = {}) {
  return damageParts(card, ctx)?.total ?? 0;
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
  { key: 'damage', label: '威力', hint: '按卡牌自身的威力（攻击力百分比）从高到低排 —— 和你的攻击力无关，所以谁的屏幕上都一样。' },
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
    damage: (a, b) => cardPowerTotal(b.card) - cardPowerTotal(a.card) || (a.card.ap - b.card.ap),
    effect: (a, b) => GROUP_INDEX[a.group] - GROUP_INDEX[b.group]
      || cardPowerTotal(b.card) - cardPowerTotal(a.card),
    ap: (a, b) => a.card.ap - b.card.ap || cardPowerTotal(b.card) - cardPowerTotal(a.card),
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
  strength: 'ico-sword',
  plays: 'ico-action_points',
  detonate: 'ico-poison',
  apBonus: 'ico-action_points',
};
const STATUS_ICO = {
  poison: 'ico-poison', toxic: 'ico-skull', burn: 'ico-flame',
  weak: 'ico-temperature_down', bleed: 'ico-heart_break_02',
};
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
        const amount = e.pct != null
          ? `${e.pct > 0 ? '+' : '−'}${Math.abs(Math.round(e.pct * 100))}%（按基础值）`
          : `${(e.amount ?? 0) > 0 ? '+' : ''}${e.amount}`;
        const down = e.pct != null ? e.pct < 0 : (e.amount ?? 0) < 0;
        rows.push({
          ico: STAT_ICO[STAT_NAME[e.stat]] ?? 'ico-star',
          label: `${who} · ${STAT_NAME[e.stat] ?? e.stat}`,
          value: `${amount}（本场战斗）`,
          note: e.target === 'enemy'
            ? (down
              ? '对手被削弱，你后面每一张攻击牌都更疼。\n属性下降最多削到基础值的 25%，之后就会提示「已经降到底了」。'
              : '把对手的属性堆上去。')
            : '战斗结束就复原。',
        });
        break;
      }
      case 'strength':
        rows.push({
          ico: KIND_ICO.strength,
          label: '攻击威力',
          value: `+${e.n}%`,
          note: '加在每一次攻击的**威力**上，不会被「攻击 -N」这类削弱吃掉。',
        });
        break;
      case 'plays':
        rows.push({ ico: KIND_ICO.plays, label: '出牌次数', value: `+${e.n} 次`, note: '本回合立刻多打几张牌。' });
        break;
      case 'apBonus':
        rows.push({ ico: KIND_ICO.apBonus, label: '下回合行动点', value: `+${e.n}`, note: '在你**下个**回合开始时额外给。' });
        break;
      case 'detonate':
        rows.push({
          ico: KIND_ICO.detonate,
          label: '引爆持续伤害',
          value: '立刻结算',
          note: `把对手身上的中毒 / 剧毒 / 灼伤层数立刻爆成伤害（每层约 ${(e.perStack ?? 3)} 倍中毒伤害）并清空。`,
        });
        break;
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
        rows.push({ ico: KIND_ICO.cleanse, label: '净化', value: '清空自身负面', note: '属性下降与中毒 / 剧毒 / 灼伤 / 虚弱 / 出血全部清掉。' });
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
