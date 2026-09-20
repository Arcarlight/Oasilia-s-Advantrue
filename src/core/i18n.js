// 多语言（i18n）的**唯一入口**。
//
// ── 设计：中文原文**就是键**（gettext 那一套）─────────────────────────────
//   t('结束回合')                 → ja 表里查「结束回合」→「ターン終了」
//   t('{name} 使用了「{card}」。', { name, card })
// 为什么不发明 ui.battle.endTurn 这种键名：
//   · 1,800 条文案，逐一取名既费事又容易和代码走散；
//   · 中文原文留在**原地**（代码里 / 内容 JSON 里），不存在「两份中文」的漂移；
//   · 相同的句子自动合成一条（「造成 {d} 点伤害。」被十几张卡共用 → 只翻一次）；
//   · 源文案改了，旧译文就变成**孤儿**，体检直接报出来（键名方案要人肉比对）。
//
// ── 两条路，同一套表 ────────────────────────────────────────────────
//   ① 内容（卡牌 / 事件 / 商人 / 道具 / 地图 / 物种）：applyContentLang() 原地改写
//      数据对象上的 name / text / desc。为什么用「原地改写」而不是给每个读取处套一层取值函数：
//      这些字段在代码里被读了上百次（卡面、卡组页、图鉴、日志、悬停说明…），逐个改既啰嗦又
//      容易漏一处 —— 漏掉的那处会静默留在中文。原地改写之后所有下游自动跟着走。
//      中文原文留在不可枚举的 _zh 副本里，切回中文时逐字恢复（来回切多少遍都不会串味）。
//   ② 界面文案与日志模板：代码里写 t('…')。
//
// ── 分批翻译的兜底 ─────────────────────────────────────────────────
//   查不到译文就**原样返回中文**。所以翻译可以一块一块推进，中间任何时刻游戏都是可玩的。
//
// 语言存在跨局记录里（meta.lang），和音量、演出速度一样属于「设置」，不是存档的一部分。

import { save } from './save.js';
import { DICTS } from '../data/i18n.js';

/** 支持的语言 */
export const LANGS = [
  { id: 'zh', name: '中文', short: '中' },
  { id: 'ja', name: '日本語', short: '日' },
  { id: 'en', name: 'English', short: 'EN' },
];

const DEFAULT_LANG = 'zh';
const isKnown = (id) => LANGS.some((l) => l.id === id);

let lang = DEFAULT_LANG;
const listeners = new Set();

export const currentLang = () => lang;
export const langInfo = (id = lang) => LANGS.find((l) => l.id === id) ?? LANGS[0];

/** 把 {name} 这种占位符替换掉；参数里没有的占位符**原样留着**（宁可显示 {n}，也不要 undefined） */
export function fill(text, params) {
  if (!params) return String(text);
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (params[k] == null ? m : String(params[k])));
}

/**
 * 取一条文案。中文模式下它就是恒等函数（直接返回原文）。
 * @param {string} zh   中文原文（同时是键）
 * @param {object} [params] 模板里的 {name} / {n} 之类
 */
export function t(zh, params) {
  if (zh == null) return '';
  const hit = lang === DEFAULT_LANG ? null : DICTS[lang]?.[zh];
  return fill(hit ?? zh, params);
}

/** 某条中文有没有译文（诊断用） */
export const hasTranslation = (zh, l = lang) => !!DICTS[l]?.[zh];
export const dictOf = (l) => DICTS[l] ?? {};

/**
 * 切换语言：改状态 → 写进跨局记录 → 通知订阅者（由 ui.js 重画当前那一屏）。
 * @param {string} id 'zh' | 'ja' | 'en'
 */
export function setLang(id, { silent = false } = {}) {
  if (!isKnown(id) || id === lang) return false;
  lang = id;
  save.patchMeta({ lang: id });
  if (!silent) for (const fn of listeners) fn(lang);
  return true;
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 启动时读一次：URL 上指定 > 跨局记录里的选择 > 按浏览器语言猜 */
export function initLang() {
  // ?lang=ja —— 诊断 / 截图用：强制某个语言，不写盘（否则会污染玩家的设置）
  if (typeof location !== 'undefined') {
    const forced = new URLSearchParams(location.search).get('lang');
    if (isKnown(forced)) { lang = forced; return lang; }
  }
  const saved = save.readMeta().lang;
  if (isKnown(saved)) { lang = saved; return lang; }
  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('ja')) lang = 'ja';
  else if (nav.startsWith('en')) lang = 'en';
  return lang;
}

/** 诊断用：直接指定语言（不写盘、不通知） */
export function forceLang(id) {
  if (isKnown(id)) lang = id;
  return lang;
}

// ---------------------------------------------------------------------------
// 内容字段：原地改写 + 中文原文备份
// ---------------------------------------------------------------------------

/**
 * 哪些字段是「给玩家看的」，需要跟着语言走。
 *
 * 导出给 tools/build-i18n.mjs 用：**待翻清单必须由这份表推导出来**，
 * 否则「运行时翻哪些」和「体检检查哪些」会各写一份，早晚对不上
 * （第一版就是这样：状态名 / 档位名 / 敌人台词漏在清单外，体检把它们报成了孤儿）。
 * 值可以是字符串，也可以是字符串数组（敌人的 `lines` 台词、`types` 属性名）。
 */
export const CONTENT_FIELDS = {
  card: ['name', 'text'],
  // bossTitle 是遭遇演出里打在那盏霓虹灯上的**称号**（「流沙之主」那种）——
  // 它以前不在字段表里，于是日 / 英模式下那一行一直是中文（同一类漏网：界面上看得见、
  // 清单里却没有）。加字段时记住：**凡是渲染出来的内容字段都要在这里登记**。
  enemy: ['name', 'lines', 'types', 'bossTitle', 'intro'],
  event: ['name', 'text'],
  // leave 是商店里那个「离开」按钮上的字（每位商人不一样：拍拍沙子走人 / 收下包裹…）
  merchant: ['name', 'role', 'greet', 'leave'],
  item: ['name', 'desc'],
  species: ['name'],
  // 地图的 desc（简介）是玩家看得见的（地图页头部）—— 以前只挂了 name，
  // 于是切到日语时那一行永远留在中文。
  // 注意**没有 sub**：章数改成按当前章节序号算（`第 {n} 章`）了，
  // 中间 4 章现在会随机换成别的地图，地图自带「第几章」这种标签必然是错的。
  biome: ['name', 'desc'],
  // 地图节点的名字与说明（战斗 / 事件 / 宝箱 / 商店 / 营地 / 首领）；
  // `names` 是「同一个节点在不同地图上的叫法」（沙漠商队 / 峡谷货栈…），是个嵌套小字典 ——
  // 读取处（screens.js 的 `t(nodeName(...))`）会查表，所以这里挂上它只为**进待翻清单**。
  node: ['name', 'desc', 'names'],
  rarity: ['name'],
  status: ['name', 'desc'],
  tier: ['name'],
  player: ['name', 'speciesName'],
};

/**
 * 一张表里的「条目」怎么取。
 *
 * 表有两种形状，都要认：
 *   · 数组 / 以 id 为键的对象 —— `CARDS`、`ENEMIES`、`STATUS_INFO`… 值是条目对象；
 *   · **单条目对象** —— 例如 `BALANCE.player`（它自己就是那个条目，不是「很多条目」）。
 * 判据是「字段名在不在这张表自己身上」；写成一处，是因为
 * tools/build-i18n.mjs 也要按同一套规则扫（各写一份的话，运行时翻了、清单里没有，
 * 体检就会把译文报成孤儿）。
 */
export function entriesOf(list, fields) {
  if (Array.isArray(list)) return list;
  if (!list || typeof list !== 'object') return [];
  if (fields.some((f) => f in list)) return [list];
  return Object.values(list);
}

/** 翻一个值：字符串直接查表，字符串数组逐个查表，别的原样返回 */
function translateValue(v) {
  if (typeof v === 'string') return lang === DEFAULT_LANG ? v : t(v);
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' && lang !== DEFAULT_LANG ? t(x) : x));
  return v;
}

/** 记下中文原文（不可枚举，免得被 JSON.stringify / 深拷贝带上） */
function rememberZh(obj, fields) {
  if (!obj || obj._zh) return;
  const zh = {};
  for (const f of fields) {
    const v = obj[f];
    if (typeof v === 'string') zh[f] = v;
    else if (Array.isArray(v)) zh[f] = [...v];
  }
  Object.defineProperty(obj, '_zh', { value: zh, enumerable: false, writable: true, configurable: true });
}

/** 把一批内容对象的可见字段改成当前语言；返回命中数（诊断拿它算覆盖率） */
function applyTable(kind, list) {
  const fields = CONTENT_FIELDS[kind];
  if (!fields) return { hit: 0, total: 0 };
  let hit = 0;
  let total = 0;
  for (const obj of entriesOf(list, fields)) {
    if (!obj || typeof obj !== 'object') continue;
    rememberZh(obj, fields);
    for (const f of fields) {
      const zhValue = obj._zh?.[f];
      if (zhValue == null) continue;
      const next = translateValue(zhValue);
      obj[f] = next;
      // 命中数按「条目」算（数组算一条），够诊断看覆盖率了
      total += 1;
      if (JSON.stringify(next) !== JSON.stringify(zhValue)) hit += 1;
    }
  }
  return { hit, total };
}

/**
 * 事件的选项（label / hint / text）是数组下标，塞不进上面的字段表，单独走一遍。
 */
/**
 * 事件选项里「所有会给玩家看的文案」都藏在哪。
 *
 * 事件选项在运行时是 `{ label, hint, run }` —— 结果文案（以及随机分支各自的文案）
 * 关在 `run()` 的闭包里，**对象上根本没有 `text` 字段**。这件事坑了两次：
 *   · `applyEventOptions` 逐字段改写时看不见它 → 切到日语，选项结果那一大段还是中文；
 *   · `build-i18n` 扫待翻清单时也看不见它 → 那 160 多条从来就没进过清单，也就永远没人翻。
 * `eventOption()` 现在把原始 spec 挂在 `_spec` 上（不可枚举），这里顺着它把文案所在的
 * **对象**都找出来 —— 运行时改写（原地改 `text`）与清单收集共用这一个函数，
 * 免得「翻译看不见的文案」这种事再发生一次。
 *
 * 结构对应 eventfx.js 的 runBlock：块可以是数组、可以是 `{effects, text, tone, special}`，
 * 效果里还有 `branch` / `if..then..else` 两种嵌套。
 */
export function optionTextNodes(opt, out = []) {
  const walkBlock = (block) => {
    if (Array.isArray(block)) { for (const b of block) walkBlock(b); return; }
    if (!block || typeof block !== 'object') return;
    if (typeof block.text === 'string') out.push(block);
    if (block.effects) walkBlock(block.effects);
    if (block.branch) for (const b of block.branch) walkBlock(b);
    if (block.if) { walkBlock(block.then); walkBlock(block.else); }
  };
  const spec = opt?._spec ?? opt;
  if (!spec || typeof spec !== 'object') return out;
  if (typeof spec.text === 'string') out.push(spec);
  if (spec.effects) walkBlock(spec.effects);
  return out;
}

/** 翻译对象上的一个字符串字段；中文原文留在不可枚举的 _zh 里，切回来逐字恢复 */
function translateField(obj, field) {
  if (!obj || typeof obj !== 'object') return { hit: 0, total: 0 };
  if (!obj._zh) {
    Object.defineProperty(obj, '_zh', { value: {}, enumerable: false, writable: true, configurable: true });
  }
  if (obj._zh[field] === undefined) obj._zh[field] = obj[field];
  const zhText = obj._zh[field];
  if (typeof zhText !== 'string') return { hit: 0, total: 0 };
  const next = lang === DEFAULT_LANG ? zhText : t(zhText);
  obj[field] = next;
  return { hit: next !== zhText ? 1 : 0, total: 1 };
}

function applyEventOptions(events) {
  let hit = 0;
  let total = 0;
  for (const ev of events ?? []) {
    for (const opt of ev?.options ?? []) {
      if (!opt || typeof opt !== 'object') continue;
      for (const f of ['label', 'hint', 'text']) {
        const r = translateField(opt, f);
        hit += r.hit; total += r.total;
      }
      // 结果文案与各分支文案（在 _spec 里的那些）
      for (const node of optionTextNodes(opt)) {
        const r = translateField(node, 'text');
        hit += r.hit; total += r.total;
      }
    }
  }
  return { hit, total };
}

/**
 * 把所有内容字段刷成当前语言。
 * @param {object} tables { card, event, merchant, item, species, biome, rarity, status }
 * @returns {{hit:number,total:number}} 命中数 / 总数（分母 = 已有的中文字段数）
 */
export function applyContentLang(tables = {}) {
  const out = { hit: 0, total: 0 };
  for (const [kind, list] of Object.entries(tables)) {
    // 事件的 name / text 就在字段表里，和其它内容一样走 applyTable；
    // 它的**选项**（label / hint / text）是数组下标，字段表表达不了，下面单独走一遍。
    const r = applyTable(kind, list);
    out.hit += r.hit;
    out.total += r.total;
  }
  const opts = applyEventOptions(tables.event);
  out.hit += opts.hit;
  out.total += opts.total;
  return out;
}
