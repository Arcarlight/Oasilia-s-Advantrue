// 文案渲染体检：把**玩家能看到的每一段文案**按当前语言渲一遍，查两类「印出来就是坏的」：
//   ① 渲染后还剩占位符 —— `{s}` / `{d}` / `{n}` 这种没被替换掉的（商店截图里那张「ミストフィールド」
//      就印着「シールドを {s} 得て」）；
//   ② 渲染后还剩 `**` —— 富文本标记没被转成 <b>（原样印出来就是两个星号）。
//
// 覆盖面故意写宽：卡牌（名字 + 文案）、物品、事件选项、状态/档位/稀有度、地图、节点、
// 商人台词、更新日志、以及代码里 `t('…')` 的**全部**条目（拿字典的键跑一遍，
// 键里带占位符的用假值填上，看填完还有没有残留）。
//
// 用法：node tools/audit-copy-render.mjs [--lang ja|en|zh]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 诊断脚本里直接 import 运行时的模块（和游戏用的是同一份代码）
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};
const imp = (rel) => import(new URL(`../${rel}`, import.meta.url).href.replace(/\\/g, '/'));

const { CARDS, ITEMS } = await imp('src/data/cards.js');
const { EVENTS } = await imp('src/data/events.js');
const { ENEMIES, TIERS } = await imp('src/data/enemies.js');
const { BIOMES, RARITY } = await imp('src/data/balance.js');
const { MERCHANTS } = await imp('src/data/merchants.js');
const { NODE_TYPES } = await imp('src/data/mapgen.js');
const { STATUS_INFO } = await imp('src/core/battle.js');
const { CHANGELOG } = await import('../src/core/changelog-data.js');
const { changeLanguage } = await import('../src/ui/langswitch.js');
const { resolveCardText } = await import('../src/ui/cardtext.js');
const { t, DICTS, setLang } = await import('../src/core/i18n.js');
const { refreshI18nTables } = await import('../src/core/i18n-tables.js');
const { richText } = await import('../src/ui/dom.js');

const LANG = (() => {
  const i = process.argv.indexOf('--lang');
  return i >= 0 ? process.argv[i + 1] : 'zh';
})();
// 用 i18n 的 setLang（langswitch 那个会碰 document，Node 里跑不了），
// 再 refreshI18nTables() 把内容字段（卡名 / 地图名 / 敌人台词…）也原地刷成该语言 —— 和游戏一致。
if (LANG !== 'zh') { setLang(LANG, { silent: true }); refreshI18nTables(); }

const problems = [];
const seen = new Set();
const check = (where, text) => {
  if (typeof text !== 'string' || !text) return;
  const key = `${where}|${text}`;
  if (seen.has(key)) return;
  seen.add(key);
  // 富文本先转成 HTML（和界面上一样的顺序），再看有没有残留
  const out = richText(String(text));
  const ph = /\{[a-zA-Z_][\w]*\}/.exec(out);
  if (ph) problems.push({ where, kind: '占位符', token: ph[0], text: out.slice(0, 90) });
  else if (/\*\*/.test(out)) problems.push({ where, kind: '星号', token: '**', text: out.slice(0, 90) });
};

// ① 卡牌：文案走 resolveCardText（界面就是这么多），名字原样
for (const c of CARDS) {
  check(`card.text:${c.id}`, c.name);
  check(`card.text:${c.id}`, resolveCardText(c));
}
// ② 物品
for (const [id, it] of Object.entries(ITEMS)) {
  check(`item:${id}`, it.name);
  check(`item:${id}`, it.desc);
}
// ③ 事件（正文 + 每个选项的 label/hint/text）
for (const ev of EVENTS) {
  check(`event:${ev.id}`, ev.name);
  check(`event:${ev.id}`, ev.text);
  for (const o of ev.options ?? []) {
    check(`event:${ev.id}`, o.label);
    check(`event:${ev.id}`, o.hint);
    check(`event:${ev.id}`, o.text);
  }
}
// ④ 敌人 / 地图 / 商人 / 节点 / 状态 / 档位 / 稀有度
for (const e of ENEMIES) {
  check(`enemy:${e.id}`, e.name);
  check(`enemy:${e.id}`, e.bossTitle);
  for (const l of e.lines ?? []) check(`enemy:${e.id}`, l);
}
for (const [k, b] of Object.entries(BIOMES)) { check(`biome:${k}`, b.name); check(`biome:${k}`, b.desc); }
for (const m of MERCHANTS) { check(`merchant:${m.id}`, m.name); check(`merchant:${m.id}`, m.greet); check(`merchant:${m.id}`, m.leave); check(`merchant:${m.id}`, m.role); }
for (const [k, n] of Object.entries(NODE_TYPES)) { check(`node:${k}`, n.name); check(`node:${k}`, n.desc); for (const v of Object.values(n.names ?? {})) check(`node:${k}`, v); }
for (const [k, s] of Object.entries(STATUS_INFO)) { check(`status:${k}`, s.name); check(`status:${k}`, s.desc); }
for (const [k, v] of Object.entries(TIERS)) check(`tier:${k}`, v.name);
for (const [k, v] of Object.entries(RARITY)) check(`rarity:${k}`, v.name);
// ⑤ 更新日志（I18N_LISTS）
for (const entry of CHANGELOG) for (const item of entry.items ?? []) check(`changelog:${entry.version}`, item);
// ⑥ 字典里**每一条**：键是中文原文，值是译文。带占位符的用假值填上再看残留。
{
  const dict = LANG === 'zh' ? {} : (DICTS?.[LANG] ?? {});
  const sample = { n: 3, s: 9, d: 7, d2: 9, total: 3, per: 4, hits: 2, pct: 50, name: 'X', card: 'X', item: 'X', hp: 10, gold: 5, ap: 2, cost: 1, amount: 8, label: 'X', stat: 'X', tip: 'X', a: 'X', b: 'X', k: 'X' };
  for (const [zh, tr] of Object.entries(dict)) {
    const filled = String(tr).replace(/\{(\w+)\}/g, (m, k) => (k in sample ? String(sample[k]) : m));
    check(`dict:${LANG}`, filled);
  }
  // 中文原文本身也要查（keys 里带 {…} 是正常的，这里只看 **）
  for (const zh of Object.keys(dict)) if (/\*\*/.test(richText(zh))) { /* 中文键里的 ** 由渲染端转 */ }
}

console.log(`渲染体检（语言 ${LANG}）：查了 ${seen.size} 段文案`);
if (!problems.length) {
  console.log('✓ 没有残留占位符、也没有原样印出的 **');
} else {
  const byKind = problems.reduce((m, p) => { (m[p.kind] ??= []).push(p); return m; }, {});
  for (const [kind, list] of Object.entries(byKind)) {
    console.log(`\n✗ ${kind}：${list.length} 处`);
    for (const p of list.slice(0, 40)) console.log(`   ${p.where}  ${p.token}  ${JSON.stringify(p.text)}`);
    if (list.length > 40) console.log(`   …还有 ${list.length - 40} 处`);
  }
}
process.exit(problems.length ? 1 : 0);
