// 把 content/i18n/*.json 编译成 src/data/i18n.js（运行时要的那份）。
//
// 为什么不直接在运行时 fetch JSON：单文件构建（oasis-game.html）是用 file:// 打开的，
// 那时 fetch 本地 JSON 会被浏览器拦掉 —— 和字体、素材同样的理由，所有内容都编译进 JS。
//
// 表的结构就是一张**短语表**：键 = 中文原文，值 = 译文（见 src/core/i18n.js 顶部的说明）。
//   { "结束回合": "ターン終了", "造成 {d} 点伤害。": "{d} のダメージを与える。" }
//
// 顺带做两件事：
//   ① 把 content/species.json 里的官方英文名（`en` 字段）预填进 en 表 —— 那是权威数据，
//      不该靠人再翻一遍（宝可梦的官方译名一个个对下来才是对的）；
//   ② 统计覆盖率，写到控制台，方便看「还剩多少没翻」。
//
// 用法: node tools/build-i18n.mjs        （改完翻译表跑一次）
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN_DIR = path.join(ROOT, 'content', 'i18n');
const OUT = path.join(ROOT, 'src', 'data', 'i18n.js');
const LANGS = ['ja', 'en'];

const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

/**
 * 去掉注释再扫。
 * 不去的话，注释里举的例子（比如 i18n.js 顶部写的 `t('结束回合')`）会被当成真的待翻文案，
 * 清单里就会多出几条永远不会显示的「幽灵文案」。
 */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // 行注释：前面不能是冒号（`https://` 这种要留着），粗略但够用
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

/**
 * 源码里的 `\n` 是**两个字符**（反斜杠 + n），而运行时的字符串里是一个换行符。
 * 短语表的键必须用**运行时那一份**（否则多行提示永远查不到译文），所以这里要反转义。
 */
function unescapeLiteral(s) {
  return s.replace(/\\(x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|[\s\S])/g, (m, esc) => {
    switch (esc[0]) {
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      case 'b': return '\b';
      case 'f': return '\f';
      case 'v': return '\v';
      case '0': return '\0';
      case 'x': return String.fromCharCode(parseInt(esc.slice(1), 16));
      case 'u': return esc[1] === '{'
        ? String.fromCodePoint(parseInt(esc.slice(2, -1), 16))
        : String.fromCharCode(parseInt(esc.slice(1), 16));
      default: return esc;
    }
  });
}

/** 收集「代码里出现的每一条中文」：t('…') 的第一参数 */
async function collectCodeStrings() {
  const out = new Map();   // 中文字符串 -> 出现在哪些文件
  const walk = async (dir) => {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { await walk(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      const text = stripComments(await fs.readFile(p, 'utf8'));
      for (const m of text.matchAll(/\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
        const zh = unescapeLiteral(m[2]);
        if (!out.has(zh)) out.set(zh, []);
        const rel = path.relative(ROOT, p).replace(/\\/g, '/');
        if (!out.get(zh).includes(rel)) out.get(zh).push(rel);
      }
    }
  };
  await walk(path.join(ROOT, 'src'));
  return out;
}

/**
 * 收集「内容里的每一段中文」。
 *
 * 关键：**问运行时要**（import I18N_TABLES 与 CONTENT_FIELDS），而不是在这里另写一份
 * 「哪些表、哪些字段要翻」的清单 —— 各写一份的下场就是「运行时翻了、清单里没有」，
 * 于是体检把那些译文全报成孤儿（第一版就是这样：状态名 / 档位名 / 敌人台词全漏在外面）。
 *
 * @returns {{content: Map<string,string[]>, official: Map<string,string>}}
 *          official 是内容里自带的官方英文名（物种 / 敌人：PMD 素材随包带来的），
 *          直接当 en 译文用 —— 宝可梦的官方译名一个个对下来才是对的。
 */
async function collectContentStrings() {
  const out = new Map();
  const official = new Map();
  const add = (s, where) => {
    if (typeof s !== 'string' || !/[\u3400-\u9fff\u3040-\u30ff]/.test(s)) return;
    if (!out.has(s)) out.set(s, []);
    if (!out.get(s).includes(where)) out.get(s).push(where);
  };
  /**
   * 字段值可能是字符串、字符串数组，**也可能是嵌套的小字典** ——
   * 例：`NODE_TYPES.shop.names = { desert: '沙漠商队', canyon: '峡谷货栈', … }`
   * （同一个节点在不同地图上叫不同的名字）。以前只认前两种，这 12 条就两头都进不去：
   * 运行时改不到、清单里也没有，于是切到日语还是中文。这里递归一层收全。
   */
  const addDeep = (v, where) => {
    if (typeof v === 'string') { add(v, where); return; }
    if (Array.isArray(v)) { for (const s of v) addDeep(s, where); return; }
    if (v && typeof v === 'object') for (const s of Object.values(v)) addDeep(s, where);
  };
  const { I18N_TABLES, I18N_WORD_TABLES = {}, I18N_LISTS = {} } = await import(new URL('../src/core/i18n-tables.js', import.meta.url).href);
  const { CONTENT_FIELDS, entriesOf, optionTextNodes } = await import(new URL('../src/core/i18n.js', import.meta.url).href);

  for (const [kind, list] of Object.entries(I18N_TABLES)) {
    const fields = CONTENT_FIELDS[kind];
    if (!fields) continue;
    for (const obj of entriesOf(list, fields)) {
      if (!obj || typeof obj !== 'object') continue;
      const where = `${kind}:${obj.id ?? obj.slug ?? obj.key ?? '?'}`;
      for (const f of fields) addDeep(obj[f], where);
      if (typeof obj.name === 'string' && typeof obj.en === 'string') official.set(obj.name, obj.en);
      // 事件的选项（label / hint）是数组下标，不在字段表里，单独收
      for (const opt of obj.options ?? []) {
        if (!opt || typeof opt !== 'object') continue;
        add(opt.label, where);
        add(opt.hint, where);
        add(opt.text, where);
        // 结果文案与随机分支各自的文案：藏在 eventOption() 的闭包里（对象上没有 text），
        // 顺着 `_spec` 找出来 —— 之前漏了它们整整 166 条，界面上一直是中文。
        for (const node of optionTextNodes(opt)) add(node.text, where);
      }
    }
  }

  /**
   * 界面上的「小词表」（属性名 / 短标签 / 悬停说明…）。
   *
   * 它们在代码里是**查表读出来**的（`t(STAT_NAMES[k])`），静态扫 `t('…')` 扫不到 ——
   * 表藏在界面模块里（那些模块 import 了 DOM，工具跑不起来）。
   * 所以由 src/core/i18n-tables.js 登记一份纯数据的词表，这里连**键和值一起**收：
   * 键（如「攻」）也会直接显示在界面上，一样要翻。
   */
  for (const [kind, table] of Object.entries(I18N_WORD_TABLES)) {
    for (const [k, v] of Object.entries(table ?? {})) {
      add(k, `ui:${kind}`);
      if (typeof v === 'string') add(v, `ui:${kind}`);
    }
  }

  /**
   * 列表形状的文案（更新日志）：递归把里面的字符串全收进来。
   * 这些文案在界面里是**渲染时才过 t()** 的裸字符串，静态扫 `t('…')` 扫不到；
   * 不收的话它们永远不会进待翻清单（切到日语还是中文）。
   */
  const addAny = (v, where) => {
    if (typeof v === 'string') { add(v, where); return; }
    if (Array.isArray(v)) { for (const x of v) addAny(x, where); return; }
    if (v && typeof v === 'object') for (const x of Object.values(v)) addAny(x, where);
  };
  for (const [kind, list] of Object.entries(I18N_LISTS)) addAny(list, `list:${kind}`);

  return { content: out, official };
}

const codeStrings = await collectCodeStrings();
const { content: contentStrings, official } = await collectContentStrings();
const allZh = new Set([...codeStrings.keys(), ...contentStrings.keys()]);

await fs.mkdir(IN_DIR, { recursive: true });
const tables = {};
const report = [];

for (const lg of LANGS) {
  const file = path.join(IN_DIR, `${lg}.json`);
  let table = {};
  try { table = await readJson(file); } catch { /* 还没有这份表 */ }
  // 去掉 _ 开头的注释键
  for (const k of Object.keys(table)) if (k.startsWith('_')) delete table[k];

  // ① 官方英文名预填（只补空缺，不覆盖人工翻的）
  if (lg === 'en') {
    let seeded = 0;
    for (const [zh, en] of Object.entries(official)) {
      if (allZh.has(zh) && !table[zh]) { table[zh] = en; seeded += 1; }
    }
    if (seeded) report.push(`  · en：从 content/species.json 预填了 ${seeded} 条官方物种名`);
  }

  // 排序写回：稳定 diff（按中文原文排）
  const sorted = {};
  for (const k of Object.keys(table).sort()) sorted[k] = table[k];
  await fs.writeFile(file, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  tables[lg] = sorted;

  const missing = [...allZh].filter((zh) => !sorted[zh]);
  report.push(`  ${lg}: 已翻 ${allZh.size - missing.length} / ${allZh.size}（${((allZh.size - missing.length) / allZh.size * 100).toFixed(0)}%）`
    + `｜界面文案 ${[...codeStrings.keys()].filter((z) => sorted[z]).length}/${codeStrings.size}`
    + `｜内容 ${[...contentStrings.keys()].filter((z) => sorted[z]).length}/${contentStrings.size}`);
}

/**
 * 占位符必须**一一对应**（`{d}` / `{d2}` / `{K}` / `{n}`）。
 *
 * 这是译文里最容易出、也最难看出来的错：少一个占位符，界面上就少一个数字 ——
 * 玩家看到的是「造成 点伤害。」或者「Deal  damage.」。批量翻译（尤其是让多个 agent 分头翻）时
 * 一定要卡这道关，所以它跟孤儿译文一样进体检。
 */
const placeholderMismatch = [];
const holes = (s) => (String(s).match(/\{(\w+)\}/g) ?? []).sort().join(',');
for (const lg of LANGS) {
  for (const [zh, tr] of Object.entries(tables[lg])) {
    if (holes(zh) !== holes(tr)) placeholderMismatch.push(`${lg} ${JSON.stringify(zh)} → ${JSON.stringify(tr)}（占位符 ${holes(zh) || '无'} ≠ ${holes(tr) || '无'}）`);
  }
}
if (placeholderMismatch.length) {
  report.push(`  ⚠ 有 ${placeholderMismatch.length} 条译文的**占位符对不上**：${placeholderMismatch.slice(0, 3).join(' ｜ ')}`);
}

// 孤儿：表里有、但现在代码/内容里找不到的中文（源文案改了或删了）
const orphansByLang = {};
for (const lg of LANGS) {
  const orphans = Object.keys(tables[lg]).filter((zh) => !allZh.has(zh));
  orphansByLang[lg] = orphans;
  if (orphans.length) {
    report.push(`  ⚠ ${lg} 有 ${orphans.length} 条**孤儿**译文（源文案已经改了 / 删了）：${orphans.slice(0, 5).map((s) => JSON.stringify(s)).join('、')}${orphans.length > 5 ? ' …' : ''}`);
  }
}

/**
 * 给体检（tools/check-content.mjs）看的一份小结。
 *
 * 为什么单独写一份：孤儿译文和覆盖率这件事只有**扫过源码**才知道，
 * 而 check-content 不该再扫一遍（那就是第二份实现，早晚和这份对不上）。
 */
await fs.writeFile(path.join(IN_DIR, '_report.json'), `${JSON.stringify({
  note: '由 tools/build-i18n.mjs 生成：待翻清单 + 各语言覆盖率 + 孤儿译文',
  neededTotal: allZh.size,
  codeStrings: codeStrings.size,
  contentStrings: contentStrings.size,
  perLang: Object.fromEntries(LANGS.map((lg) => {
    const done = [...allZh].filter((zh) => tables[lg][zh]).length;
    return [lg, {
      done,
      total: allZh.size,
      percent: Math.round((done / allZh.size) * 1000) / 10,
      codeDone: [...codeStrings.keys()].filter((z) => tables[lg][z]).length,
      contentDone: [...contentStrings.keys()].filter((z) => tables[lg][z]).length,
    }];
  })),
  // 还差哪些（原文照抄，方便直接搜 / 直接补）
  //
  // 注意：这里**不能截断**。以前写的是 `.slice(0, 80)`，于是「机器可读的待翻清单」只有 80 条 ——
  // 加了一整批内容（新名单 185 条）之后，照这份清单去翻就只翻了前 80 条，
  // 剩下的静默留在中文里（而且看报表还以为「清单就这么多」）。
  // 报表是给工具链读的，就该是完整的；要给人看的话，控制台那段覆盖率足够。
  missing: Object.fromEntries(LANGS.map((lg) => [lg, [...allZh].filter((zh) => !tables[lg][zh])])),
  orphans: orphansByLang,
  placeholders: placeholderMismatch,
}, null, 2)}\n`, 'utf8');

const body = LANGS.map((lg) => `  ${lg}: ${JSON.stringify(tables[lg], null, 2).split('\n').join('\n  ')},`).join('\n');
const out = `// 多语言短语表（由 tools/build-i18n.mjs 从 content/i18n/*.json 生成，别手改这个文件）
//
// 键 = **中文原文**，值 = 译文。运行时由 src/core/i18n.js 的 t() 查表；
// 查不到就原样返回中文，所以翻译可以分批推进，中间任何时刻游戏都是可玩的。

// #region GENERATED-I18N
export const DICTS = {
${body}
};
export const LANG_IDS = ${JSON.stringify(LANGS)};
// #endregion GENERATED-I18N
`;
await fs.writeFile(OUT, out, 'utf8');

console.log(`多语言表：${allZh.size} 条待翻（界面文案 ${codeStrings.size} + 内容 ${contentStrings.size}）`);
for (const line of report) console.log(line);
console.log(`生成 ${path.relative(ROOT, OUT).replace(/\\/g, '/')}`);
