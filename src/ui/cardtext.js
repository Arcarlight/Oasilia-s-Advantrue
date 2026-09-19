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
// 高亮规则**按语言构建**（见下面「高亮规则」一节）：卡面文案现在会跟着语言原地改写，
// 只认中文的正则切不了日 / 英的卡面，切到日语时整张卡就一个高亮都没有了。
//
// 唯一的真相仍然是 content/cards.json：文案和高亮都只是「读」它，不改写。

import { el } from './dom.js';
import { STATUS_INFO, computeHit } from '../core/battle.js';
import { BALANCE } from '../data/balance.js';
import { t, currentLang } from '../core/i18n.js';

/** 文案里出现的状态词 → 引擎里的状态 key（「流血」和引擎的「出血」是同一个东西） */
const STATUS_WORD = { 中毒: 'poison', 剧毒: 'toxic', 灼伤: 'burn', 虚弱: 'weak', 出血: 'bleed', 流血: 'bleed' };

/**
 * 护盾随防御成长时的除数：引擎里是 `amount × (1 + 防御 ÷ 12)`
 * （见 battle.js 的 case 'shield'）。这里用它把「这张卡的护盾吃多少防御」算出来，
 * 免得在文案里写死一个系数 —— 系数其实跟着每张卡自己的基数走。
 */
const DEF_PER_SHIELD = 12;

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
  攻击: () => t('攻击：决定你打出多少伤害。实际伤害 = 攻击 × 招式威力% × {K} ÷ ({K} + 对手防御)。\n所以「攻击 +4」等于后面每一张牌都按比例更疼，越到后期越值钱。', { K: BALANCE.armorK }),
  防御: () => t('防御：越高越抗打，公式里它是「减伤百分比」。\n降对手防御 = 你后面每一张攻击牌都更疼。'),
  敏捷: () => t('敏捷：每回合的行动点、抽牌数、出牌上限都看它。'),
  幸运: () => t('幸运：暴击率与闪避率，暴击伤害 ×{mult}。', { mult: BALANCE.luckCritMult }),
};
const STAT_ICO = { atk: 'ico-sword', def: 'ico-shield', agi: 'ico-shoe', luck: 'ico-clover' };

const TIP = {
  shield: () => t('护盾：先于 HP 承受伤害，持有者自己的回合开始时清空——所以它是「撑过这一轮」的资源。'),
  // 引擎算护盾是 amount × (1 + 防御 ÷ 12)，所以「加多少」跟着**每张卡自己的基数**走：
  // 基数 9 的卡是「+防御×0.75」，基数 13 的卡是「+防御×1.08」。
  // 这里以前写成固定的「×0.75」，基数不是 9 的卡悬停看到的公式就是错的。
  shieldScale: () => t('护盾量随**防御**成长：实际护盾 = 卡面基数 × (1 + 防御 ÷ {div})。\n所以基数越大的护盾牌，吃到的防御加成也越多。', { div: DEF_PER_SHIELD }),
  // 层数翻倍（新机制）：说清「怎么用才对」——它本身不产生伤害，全靠已经铺好的层数
  statusDouble: () => t('层数翻倍：把目标身上已有的**中毒 / 剧毒 / 灼伤 / 出血层数直接 ×2**。\n对手身上还没有层数时它不生效 —— 先铺层数再翻倍，收益是翻着涨的，配「引爆」收尾最狠。'),
  exhaust: () => t('销毁：打出后进销毁区，**本场战斗不会再抽到**（一场只能用一次）。'),
  exhaustHand: () => t('销毁手牌：把手里剩下的牌全部销毁。'),
  discard: () => t('弃牌：进弃牌堆，牌堆抽空时会洗净再抽回来。'),
  draw: () => t('抽牌：从卡组顶抽到手牌。\n打出去的牌会进**弃牌区**，牌堆抽空、还要再抽的时候，弃牌区才会洗回牌堆。所以牌组薄的时候，同一张牌一轮里能被打上好几次 —— 但每回合的出牌次数是有限的。'),
  ap: () => t('行动点（AP）：每回合回满，数量 = {base} + 敏捷 ÷ {per}（上限 {max}）。打出卡牌要花 AP。', { base: BALANCE.apBase, per: BALANCE.apPerAgi, max: BALANCE.apMax }),
  heal: () => t('回复：按固定值或**最大生命**的百分比恢复 HP。百分比类的后期一样有用。'),
  maxHp: () => t('最大生命：治疗百分比、中毒 / 灼伤这些持续伤害都按它算。'),
  luck: () => t('暴击与闪避都看**幸运**：暴击伤害 ×{mult}，闪避直接免掉这一下。', { mult: BALANCE.luckCritMult }),
  recoil: () => t('反伤：这一下打出去，自己也要吃一份固定伤害（打不死自己）。'),
  cleanse: () => t('净化：清掉自己身上所有的属性下降与负面状态（中毒 / 剧毒 / 灼伤 / 虚弱 / 出血）。'),
  pierce: () => t('破防：这一下的伤害计算里，对手防御只按剩余比例生效。'),
  cost: () => t('费用买的是威力：**威力是攻击力的百分比**（威力 110 = 打出 1.1 倍攻击）。\n每点 AP 买到的威力随费用上升，所以「把 AP 花在贵牌上」永远比连打 0 费牌划算。'),
  strength: () => t('力量：不改属性面板，直接给**每一次攻击**的威力加一个百分比。\n和攻击力的区别是它不会被「攻击 -N」之类的削弱吃掉。'),
};

function statusTip(word) {
  const key = statusKeyOf(word);
  const info = STATUS_INFO[key];
  if (!info) return '';
  // 解状态牌的**真名字**从译文表里取（以前这里写死「白雾」「焕然一新」的译名，
  // 结果日文写成「白い霧」「一新」、英文写成 White Mist / Fresh Start —— 都不是那两张卡的名字）。
  return t('{name}：{desc}\n解法：「{a}」「{b}」这类解状态牌能直接清掉；层数就是强度。', {
    name: info.name, desc: info.desc, a: t('白雾'), b: t('焕然一新'),
  });
}

// ============================================================
// 高亮规则：跟着语言构建
// ============================================================
// 规则表以前是**一份写死的中文正则**。卡面文案改成跟着语言原地改写（applyContentLang）之后，
// 切到日语 / 英语就一条都匹配不上 —— 没有高亮、没有悬停说明，整张卡看着像「忘了做」。
// 现在按语言构建，在**取用时**比对 currentLang()，语言一变就重建：
//   · t() 不能在模块顶层调用（那时语言还没初始化，会把中文冻进表里）；
//   · 但也不能只在加载时建一次（语言是运行时可切的）。
//   → 所以是「按语言缓存的惰性构建」。
//
// 词从哪儿来（三条路各管一段）：
//   ① 单词类关键词（护盾 / 销毁 / 最大生命 / 回复 / 抽牌 / 威力 / 攻击…）：这些**本身就是译文表的键**，
//      直接从 t('护盾') 取。译文哪天把「シールド」改成「盾」，规则跟着改，不会走散。
//   ② 搭配类关键词（状态层数 / 破防 / 净化 / 护盾随防御成长）：中日英的**语序和词形完全不一样**
//      （中文「3 层中毒」数字在前，日文「どく 3 層」数字在后，英文「3 stacks of Poison」又是另一套），
//      从单词拼不出句子，只能照着 content/i18n/*.json 里**真实的卡面文案**写正则。
//      每条都注了它对应的真实文案。
//   ③ 译文表里没有独立词条的（暴击 / 闪避 / 反伤 / 力量 / 流血）：它们在表里只出现在长句里，
//      查不到单词，只能写死 —— 而卡池里目前没有卡面用到它们，属于「以后加了也不会瞎」的兜底。
//
// 中文那条路（下面的 ZH_RULES）**一个字都没动**，构建出来的正则和以前逐字一致。

/**
 * 中文规则表。用**粘性正则**（/y）从当前位置匹配，多个规则同时命中时取最长的一段 ——
 * 「无视对手一半防御」比「防御」长，所以整句会被当成一个破防关键词，而不是拦腰截一半。
 */
const ZH_RULES = [
  // 状态（连层数一起染色：读作「3 层中毒」比拆成红色 3 + 紫色中毒更好认）
  {
    src: '(?:\\d+\\s*层\\s*)?(中毒|剧毒|灼伤|虚弱|出血|流血)',
    cls: (m) => `kw-status kw-${STATUS_WORD[m[1]]}`,
    tip: (m) => statusTip(m[1]),
  },
  // 「无视对手 50% 防御」这种卡面本来只亮到「防御」两个字（规则里只有 全部 / 一半）——
  // ja / en 两条是按真实译文写的、认得出百分比，所以中文这条也补上，三种语言口径一致。
  { src: '无视对手(?:全部|一半|\\d+\\s*%)防御', cls: 'kw-pierce', tip: TIP.pierce },
  // 层数翻倍（新机制）：毒流 / 出血流的放大器。整句一起染色，悬停说明它「先铺后翻」的用法
  { src: '(?:持续伤害)?层数翻倍|层数\\s*×\\s*2|翻倍', cls: 'kw-status', tip: TIP.statusDouble },
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
  { src: '(攻击|防御|敏捷|幸运)', cls: 'kw-stat', tip: (m) => STAT_DESC[m[1]]?.() },
  { src: '[+\\-]?\\d+(?:\\.\\d+)?%?', cls: 'card-num', tip: null },
];

/** 数字（伤害 / 层数 / 百分比）：三种语言通用，不放语言表里 */
const NUM_RULE = { src: '[+\\-]?\\d+(?:\\.\\d+)?%?', cls: 'card-num', tip: null };

/** 状态的中文原文（同时也是译文表的键）→ 引擎状态 key */
const STATUS_ZH_WORD = { poison: '中毒', toxic: '剧毒', burn: '灼伤', weak: '虚弱', bleed: '出血' };

/** 四项属性的中文原文（STAT_DESC 的键） */
const STAT_ZH_WORD = ['攻击', '防御', '敏捷', '幸运'];

/**
 * 文案里出现的状态词 → 引擎状态 key。
 * 中文那一套先查（STATUS_WORD 里还有「流血」这个别名，中文卡面在用它），
 * 日 / 英按译文表反推 —— 日语是平假名（どく / もうどく / …），英语是 Poison / Toxic / …。
 */
function statusKeyOf(word) {
  if (STATUS_WORD[word]) return STATUS_WORD[word];
  for (const [key, zh] of Object.entries(STATUS_ZH_WORD)) {
    const w = t(zh);
    // 英文会被句子的大小写改掉首字母（句首 Poison / 句中 poison）；中日文没有这回事
    if (w === word || (/^[A-Za-z]/.test(w) && w.toLowerCase() === String(word).toLowerCase())) return key;
  }
  return null;
}

/** 转义正则元字符（英文译文里 max HP、+、( 都可能出现） */
function escRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** 词条 → 正则片段：空白放宽成 \s*（译文里加不加空格不统一：「最大HP」/「最大 HP」） */
function lit(s) {
  return escRe(s).replace(/\s+/g, '\\s*');
}
/** 首字母大小写都认（英文卡面句首大写、句中全小写：Gain shield / scales with Defense） */
function ci(s) {
  return lit(s).replace(/^([A-Za-z])/, (c) => `[${c.toLowerCase()}${c.toUpperCase()}]`);
}

/** 当前语言下五个状态名的正则片段（长词在前，免得「もうどく」被「どく」拦腰截一半） */
function statusWords(wrap) {
  return Object.values(STATUS_ZH_WORD)
    .map((zh) => t(zh))
    .sort((a, b) => b.length - a.length)
    .map(wrap)
    .join('|');
}

/** 当前语言下四项属性名的正则片段 + 「本地化词 → STAT_DESC 的键」 */
function statWords(wrap) {
  const pairs = STAT_ZH_WORD.map((zh) => [t(zh), zh]);
  return {
    src: pairs.map(([w]) => wrap(w)).sort((a, b) => b.length - a.length).join('|'),
    zhOf: Object.fromEntries(pairs),
  };
}

/** 日文规则：单词取自译文表，搭配按 content/i18n/ja.json 里真实的卡面文案写 */
function rulesJa() {
  const status = statusWords(lit);   // どく|もうどく|やけど|じゃくたい|しゅっけつ
  const stat = statWords(lit);       // 攻撃|防御|敏捷|幸運
  return [
    // 「相手にじゃくたいを 1 付与する」「どく 3 層」「やけどを 2 付与する」「しゅっけつ2層」
    // —— 中文是「3 层中毒」（数字在前），日文是「どく 3 層」（数字在后），空格也时有时无；
    //    「を」只在后面真跟着数字时才吃进来，免得把「じゃくたいを浄化」的助词也染上色
    { src: `(${status})(?:(?:を)?\\s*\\d+\\s*層?)?`, cls: (m) => `kw-status kw-${statusKeyOf(m[1])}`, tip: (m) => statusTip(m[1]) },
    // 「相手の防御をすべて無視」「相手の防御を半分無視」「相手の防御を 50% 無視」
    { src: '相手の防御を(?:すべて|半分|\\d+\\s*%)?\\s*無視', cls: 'kw-pierce', tip: TIP.pierce },
    // 層数翻倍（新機制）：「層数が倍になる」「層数が 2 倍」「倍増」
    { src: '層数[^。]{0,6}倍|倍増', cls: 'kw-status', tip: TIP.statusDouble },
    // 「自分の能力ダウンと状態異常をすべて消し」「自身のマイナス効果をすべて消す」「自身のじゃくたいを浄化」
    { src: '(?:能力ダウン|状態異常|マイナス効果)[^、。]{0,12}?消|浄化', cls: 'kw-cleanse', tip: TIP.cleanse },
    // 「防御に応じて増加 / 成長」「防御に応じたシールドを獲得」
    // —— 只吃「防御に応じて / 応じた」这一小段，后面的シールド 交给下面那条护盾规则，
    //    和中文那边「随防御成长」+「护盾」两条分开认是同一个口径
    { src: '防御に応じ(?:て|た)', cls: 'kw-shield', tip: TIP.shieldScale },
    { src: lit(t('护盾')), cls: 'kw-shield', tip: TIP.shield },       // シールド
    { src: lit(t('销毁')), cls: 'kw-exhaust', tip: TIP.exhaust },     // 消滅
    // t('最大生命') = 「最大HP」，可卡面里另有「最大 HP」这种加了空格的写法
    { src: '最大\\s*HP', cls: 'kw-heal', tip: TIP.maxHp },
    { src: lit(t('回复')), cls: 'kw-heal', tip: TIP.heal },           // 回復
    { src: lit(t('抽牌')), cls: 'kw-draw', tip: TIP.draw },           // ドロー
    { src: 'AP', cls: 'kw-ap', tip: TIP.ap },
    { src: '会心|回避', cls: 'kw-luck', tip: TIP.luck },              // 暴击 / 闪避（表里没有独立词条）
    { src: '反動', cls: 'kw-recoil', tip: TIP.recoil },               // 反伤
    { src: lit(t('威力')), cls: 'kw-ap', tip: TIP.cost },             // 威力
    { src: 'ちから', cls: 'kw-stat', tip: TIP.strength },             // 力量
    { src: `(${stat.src})`, cls: 'kw-stat', tip: (m) => STAT_DESC[stat.zhOf[m[1]]]?.() },
    NUM_RULE,
  ];
}

/** 英文规则：单词取自译文表（首字母大小写都认），搭配按 content/i18n/en.json 里真实的卡面文案写 */
function rulesEn() {
  const status = statusWords(ci);    // Poison|Toxic|Burn|Weakened|Bleed
  const stat = statWords(ci);        // Attack|Defense|Agility|Luck
  return [
    // 「1 Poison」「3 stacks of Poison」「2 stacks of Bleed」「如果你身上有 Poison or Toxic」
    { src: `(?:\\d+\\s+(?:stacks? of\\s+)?)?(${status})`, cls: (m) => `kw-status kw-${statusKeyOf(m[1])}`, tip: (m) => statusTip(m[1]) },
    // 「ignoring all enemy Defense」「ignoring half Defense」「ignoring 50% of the foe's Defense」
    { src: 'ignoring (?:all|half|\\d+\\s*%)(?:[^.;]{0,24}?)Defense', cls: 'kw-pierce', tip: TIP.pierce },
    // Doubles the stacks（新机制）：卡面写的是「doubles the Poison / Toxic / Burn / Bleed stacks」
    { src: '[Dd]oubl(?:e|es|ing)[^.;]{0,20}?stack', cls: 'kw-status', tip: TIP.statusDouble },
    // 「Cleanse stat drops and negative statuses」「cleanse all negative status on yourself」
    { src: ci(t('净化')), cls: 'kw-cleanse', tip: TIP.cleanse },
    // 「Gain shield (scales with Defense…)」——卡面里「随防御成长」的译法都是这一句
    { src: '(?:scales|scaling) with Defense', cls: 'kw-shield', tip: TIP.shieldScale },
    { src: ci(t('护盾')), cls: 'kw-shield', tip: TIP.shield },        // Shield
    { src: ci(t('销毁')), cls: 'kw-exhaust', tip: TIP.exhaust },      // Exhaust
    { src: ci(t('最大生命')), cls: 'kw-heal', tip: TIP.maxHp },       // max HP
    // t('回复') = 「Heal」，可卡面里回复 HP 还写作「Restore」，回复 AP 又写作「refund」
    // （中文那边一律是「回复」两个字，所以这几个都得收进来才是同一个口径）
    { src: `${ci(t('回复'))}|${ci('Restore')}|refund`, cls: 'kw-heal', tip: TIP.heal },
    { src: ci(t('抽牌')), cls: 'kw-draw', tip: TIP.draw },            // Draw / draw
    { src: `AP|${ci(t('行动点'))}`, cls: 'kw-ap', tip: TIP.ap },      // AP / Action points
    { src: '[Cc]rit|[Dd]odge', cls: 'kw-luck', tip: TIP.luck },       // 暴击 / 闪避（表里没有独立词条）
    { src: ci('Recoil'), cls: 'kw-recoil', tip: TIP.recoil },         // 反伤
    { src: ci(t('威力')), cls: 'kw-ap', tip: TIP.cost },              // Power
    { src: ci('Strength'), cls: 'kw-stat', tip: TIP.strength },       // 力量
    // 属性：Defense 在护盾公式里被缩写成了「DEF×0.75」「Def×0.75」（harden / feather_dance），
    // 中文那边写的是「防御×0.75」照样认得出，所以缩写也得认 —— 悬停说明还是「防御」那一份
    { src: `(${stat.src}|DEF|Def)`, cls: 'kw-stat', tip: (m) => STAT_DESC[stat.zhOf[m[1]] ?? '防御']?.() },
    NUM_RULE,
  ];
}

/** 语言 → 规则构建器（没有专门表的语言退回中文那套，总比一条都不亮好） */
const RULE_BUILDERS = { zh: () => ZH_RULES, ja: rulesJa, en: rulesEn };

/** 按语言缓存的规则表：语言是可切的，所以每次取用都比一次 */
let ruleCache = { lang: null, rules: null };

function rulesFor(lang = currentLang()) {
  if (ruleCache.lang !== lang) {
    const build = RULE_BUILDERS[lang] ?? RULE_BUILDERS.zh;
    ruleCache = { lang, rules: build().map((r) => ({ ...r, re: new RegExp(r.src, 'y') })) };
  }
  return ruleCache.rules;
}

/** 从位置 i 起，找出最长的一条高亮规则 */
function matchAt(text, i) {
  let best = null;
  for (const r of rulesFor()) {
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
  { key: 'status', label: () => t('赋予状态（持续掉血）') },
  { key: 'weaken', label: () => t('削弱对手') },
  { key: 'buff', label: () => t('强化自身') },
  // 净化排在「回复与护盾」前面：白雾这类牌同时给护盾，但它的身份是「解状态」，
  // 按护盾归类会让玩家在一堆防御牌里找不到它。
  { key: 'cleanse', label: () => t('净化与解状态') },
  { key: 'sustain', label: () => t('回复与护盾') },
  { key: 'tempo', label: () => t('抽牌与行动点') },
  { key: 'plain', label: () => t('纯伤害（无附加效果）') },
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
  { key: 'default', label: () => t('默认'), hint: () => t('按卡组里的原始顺序（拿到手的先后）。') },
  { key: 'damage', label: () => t('威力'), hint: () => t('按卡牌自身的威力（攻击力百分比）从高到低排 —— 和你的攻击力无关，所以谁的屏幕上都一样。') },
  { key: 'effect', label: () => t('特殊效果'), hint: () => t('按「除了伤害还干什么」分七组：状态 / 削弱 / 强化 / 净化 / 回复护盾 / 抽牌 / 纯伤害。') },
  { key: 'ap', label: () => t('费用'), hint: () => t('按行动点费用从低到高排。') },
  { key: 'rarity', label: () => t('稀有度'), hint: () => t('按稀有度从高到低排。') },
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
  return SPECIAL_GROUPS.find((g) => g.key === key)?.label() ?? '';
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
  statusDouble: 'ico-temperature_down',
  apBonus: 'ico-action_points',
};
const STATUS_ICO = {
  poison: 'ico-poison', toxic: 'ico-skull', burn: 'ico-flame',
  weak: 'ico-temperature_down', bleed: 'ico-heart_break_02',
};
const STAT_NAME = { atk: () => t('攻击'), def: () => t('防御'), agi: () => t('敏捷'), luck: () => t('幸运') };

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
          ? (dmg.hits > 1 ? t('{per} × {hits} 次 = {total} 点', { per: dmg.per, hits: dmg.hits, total: dmg.total }) : t('{total} 点', { total: dmg.total }))
          : t('按攻防结算');
        const notes = [];
        if (e.ignoreDefPct >= 1) notes.push(t('无视对手全部防御'));
        else if (e.ignoreDefPct > 0) notes.push(t('无视对手 {pct}% 防御', { pct: Math.round(e.ignoreDefPct * 100) }));
        if (dmg?.alt && e.execThreshold) notes.push(t('对手 HP 低于 {threshold}% 时改为 {alt} 点', { threshold: Math.round(e.execThreshold * 100), alt: dmg.alt }));
        if (e.drainPct) notes.push(t('回复所造成伤害的 {pct}%', { pct: Math.round(e.drainPct * 100) }));
        if (e.recoilPct) notes.push(t('自身受到约 {n} 点反伤（伤害的 {pct}%）', { n: Math.round((dmg?.total ?? 0) * e.recoilPct), pct: Math.round(e.recoilPct * 100) }));
        rows.push({ ico: 'ico-sword', label: t('伤害'), value, note: notes.join('；') });
        break;
      }
      case 'status': {
        const info = STATUS_INFO[e.status];
        const chance = e.chance ? t('{pct}% 概率命中（对手可能抵抗）', { pct: Math.round(e.chance * 100) }) : (info?.desc ?? '');
        rows.push({
          ico: STATUS_ICO[e.status] ?? 'ico-warn',
          label: t('对手 · {name}', { name: info?.name ?? e.status }),
          value: t('{n} 层', { n: e.stacks ?? 1 }),
          note: chance,
          // 详情页是深色底，这里用战斗界面那套亮色（STATUS_INK 是给米黄卡面压暗用的）
          ink: info?.color,
        });
        break;
      }
      case 'buff': {
        const who = e.target === 'enemy' ? t('对手') : t('自身');
        const amount = e.pct != null
          ? t('{sign}{pct}%（按基础值）', { sign: e.pct > 0 ? '+' : '−', pct: Math.abs(Math.round(e.pct * 100)) })
          : `${(e.amount ?? 0) > 0 ? '+' : ''}${e.amount}`;
        const down = e.pct != null ? e.pct < 0 : (e.amount ?? 0) < 0;
        rows.push({
          ico: STAT_ICO[e.stat] ?? 'ico-star',
          label: t('{who} · {stat}', { who, stat: STAT_NAME[e.stat]?.() ?? e.stat }),
          value: t('{amount}（本场战斗）', { amount }),
          note: e.target === 'enemy'
            ? (down
              ? t('对手被削弱，你后面每一张攻击牌都更疼。\n属性下降最多削到基础值的 25%，之后就会提示「已经降到底了」。')
              : t('把对手的属性堆上去。'))
            : t('战斗结束就复原。'),
        });
        break;
      }
      case 'strength':
        rows.push({
          ico: KIND_ICO.strength,
          label: t('攻击威力'),
          value: `+${e.n}%`,
          note: t('加在每一次攻击的**威力**上，不会被「攻击 -N」这类削弱吃掉。'),
        });
        break;
      case 'plays':
        rows.push({ ico: KIND_ICO.plays, label: t('出牌次数'), value: t('+{n} 次', { n: e.n }), note: t('本回合立刻多打几张牌。') });
        break;
      case 'apBonus':
        rows.push({ ico: KIND_ICO.apBonus, label: t('下回合行动点'), value: `+${e.n}`, note: t('在你**下个**回合开始时额外给。') });
        break;
      case 'detonate':
        rows.push({
          ico: KIND_ICO.detonate,
          label: t('引爆持续伤害'),
          value: t('立刻结算'),
          note: t('把对手身上的中毒 / 剧毒 / 灼伤层数立刻爆成伤害（每层约 {per} 倍中毒伤害）并清空。', { per: e.perStack ?? 3 }),
        });
        break;
      /**
       * 层数翻倍（本次新增的机制）：毒流 / 出血流的放大器。
       * 详情页要说清两件事：翻的是哪几种、以及「先铺后翻才划算」——
       * 不然玩家会当成一张空牌（对手身上没层数时它什么都不做）。
       */
      case 'statusDouble':
        rows.push({
          ico: KIND_ICO.statusDouble ?? 'ico-temperature_down',
          label: t(e.target === 'self' ? '自身 · 持续伤害层数' : '对手 · 持续伤害层数'),
          value: t('×2'),
          note: t('把目标身上已有的中毒 / 剧毒 / 灼伤 / 出血层数**直接翻倍**。\n对手身上没有层数时不会生效 —— 先铺层数再用它，收益是翻着涨的。'),
        });
        break;
      case 'shield':
        // 引擎：护盾 = amount × (1 + 防御 ÷ 12)，所以系数是 **amount ÷ 12**，不是固定的 0.75
        // （这里以前写死 0.75：基数 9 的卡碰巧对，基数 13 的卡就少算了三成）
        rows.push({
          ico: KIND_ICO.shield,
          label: t('护盾'),
          value: e.scaleWithDef ? t('约 {amount} + 防御 × {k}', { amount: e.amount, k: (e.amount / DEF_PER_SHIELD).toFixed(2) }) : t('{amount} 点', { amount: e.amount }),
          note: e.scaleWithDef ? t('随防御成长，后期一样有用。') : t('回合开始时清空。'),
        });
        break;
      case 'heal':
        rows.push({
          ico: KIND_ICO.heal,
          label: t('回复'),
          value: e.pct ? t('最大生命的 {pct}%', { pct: Math.round(e.pct * 100) }) : t('{amount} 点 HP', { amount: e.amount }),
          note: e.pct ? t('按最大生命算，血量越厚回得越多。') : '',
        });
        break;
      case 'draw':
        rows.push({ ico: KIND_ICO.draw, label: t('抽牌'), value: t('{n} 张', { n: e.n }), note: t('卡组抽空时把弃牌堆洗回来。') });
        break;
      case 'ap':
        rows.push({ ico: KIND_ICO.ap, label: t('行动点'), value: `+${e.n}`, note: t('可以立刻再打一张牌。') });
        break;
      case 'cleanse':
        rows.push({ ico: KIND_ICO.cleanse, label: t('净化'), value: t('清空自身负面'), note: t('属性下降与中毒 / 剧毒 / 灼伤 / 虚弱 / 出血全部清掉。') });
        break;
      case 'exhaustHand':
        rows.push({ ico: 'ico-trash', label: t('销毁手牌'), value: t('打出时清空手牌'), note: TIP.exhaustHand() });
        break;
      case 'discard':
        rows.push({ ico: 'ico-shuffle', label: t('弃牌'), value: t('{n} 张', { n: e.n ?? 1 }), note: TIP.discard() });
        break;
      default:
        rows.push({ ico: 'ico-star', label: e.kind, value: '', note: '' });
    }
  }

  if (card?.exhaust) {
    rows.push({ ico: 'ico-trash', label: t('销毁'), value: t('使用后进销毁区'), note: t('本场战斗不会再抽到，一场只能打一次。') });
  }
  return rows;
}
