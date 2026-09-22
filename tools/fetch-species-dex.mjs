// 从 52wiki（wiki.52poke.com）抓「图鉴介绍」，给战斗背景那层波浪花纹文字用。
//
// 用户的意思：背景上的字**只是图案**，所以只用简体中文，不进多语言清单
// （日 / 英模式也照样铺中文 —— 那是纹理，不是内容）。
// 文本来源用户也指定了：「文本可以直接采用52wiki上对应的宝可梦介绍」。
//
// 怎么取：52wiki 每只宝可梦的页面里有一个 `{{图鉴|...}}` 模板，形如
//     |ladex=-{zh-hans:…;zh-hant:…}-      ← 官方简繁两版，我们只要 zh-hans
//   各代都有自己的一格（diamonddex / hgssdex / bwdex / xdex / Swdex / ladex…），
//   内容基本一样，只是措辞随代变化。这里按 PREFER 的顺序挑**最新且存在**的那一格：
//   越新的描述越短、越像「一句介绍」，正好适合当背景花纹。
//
// 这个机器直连 wiki.52poke.com 不通，要走本地代理：
//   $env:NODE_USE_ENV_PROXY="1"; $env:HTTPS_PROXY="http://127.0.0.1:7897"; node tools/fetch-species-dex.mjs
//
// 产物：
//   tools/_species-dex-raw.json    原始抓取结果（带缓存，中断了能接着跑）
//   content/species-dex.json       给游戏用的那份 { dex: { <slug>: "…" } }
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'tools', '_species-dex-raw.json');
const OUT = path.join(ROOT, 'content', 'species-dex.json');

/** 各代图鉴格子的偏好顺序（越前面越优先；只取第一个存在的） */
const PREFER = ['ladex', 'Swdex', 'Shdex', 'bddex', 'spdex', 'usumdex', 'smdex', 'xydex', 'xdex', 'ydex', 'b2w2dex', 'bwdex', 'hgssdex', 'platinumdex', 'pearldex', 'diamonddex', 'dex'];

const species = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'species.json'), 'utf8')).species;
const enemies = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'enemies.json'), 'utf8')).enemies;
const heroes = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'heroes.json'), 'utf8')).heroes;

/** 真正用得到的物种：敌人的 slug + 两位主角的物种（背景上下两半各用一份） */
const want = [...new Set([...enemies.map((e) => e.slug), ...heroes.map((h) => h.species)])].sort();
console.log(`需要 ${want.length} 个物种的图鉴文本（敌人 ${new Set(enemies.map((e) => e.slug)).size} + 主角物种）`);

let raw = {};
try { raw = JSON.parse(await fs.readFile(RAW, 'utf8')); } catch { /* 第一次跑 */ }

const api = (title) => 'https://wiki.52poke.com/api.php?action=parse&prop=wikitext&format=json&formatversion=2'
  + `&page=${encodeURIComponent(title)}`;

/** 从图鉴模板的 wikitext 里挑一条 zh-hans 文本 */
function pickDex(wikitext) {
  /**
   * ⚠ 不能用 `\{\{图鉴\b` —— `\b` 是**词边界**，而汉字在正则里算「非词字符」，
   * 「图鉴」后面再接 `\b` 就永远不成立（第一版就是这么把 195 只全判成「没有图鉴模板」的）。
   * 直接找模板起点，再往后找模板结尾那一行 `}}`。
   */
  const i = wikitext.indexOf('{{图鉴');
  if (i < 0) return null;
  const end = wikitext.indexOf('\n}}', i);
  const tpl = wikitext.slice(i, end < 0 ? Math.min(wikitext.length, i + 6000) : end);
  const fields = {};
  for (const m of tpl.matchAll(/\n\s*\|([A-Za-z0-9_]+)\s*=\s*([^\n]*)/g)) fields[m[1]] = m[2];
  const zhHans = (v) => {
    const m = /zh-hans:([\s\S]*?)(?:;zh-hant:|;zh-cn:|;zh-tw:|;zh-hk:|\}-|$)/.exec(v ?? '');
    const s = (m ? m[1] : String(v ?? '')).replace(/^-\{|-\}$/g, '').trim();
    return s.replace(/\s+/g, '');
  };
  for (const key of PREFER) {
    if (fields[key]) {
      const s = zhHans(fields[key]);
      if (s) return { text: s, from: key };
    }
  }
  // 偏好表里都没有：拿模板里第一个像图鉴文本的格子
  for (const [k, v] of Object.entries(fields)) {
    if (!/dex$/i.test(k) || k === 'type' || k === 'gen') continue;
    const s = zhHans(v);
    if (s) return { text: s, from: k };
  }
  return null;
}

let done = 0; let fails = [];
for (const slug of want) {
  if (raw[slug]?.text) { done += 1; continue; }
  const sp = species[slug];
  if (!sp?.name) { fails.push(`${slug}（species.json 里没名字）`); continue; }
  let payload = null;
  for (let attempt = 0; attempt < 3 && !payload; attempt += 1) {
    try {
      const r = await fetch(api(sp.name), { headers: { 'User-Agent': 'oasis-fan-game-content/1.0 (contact: local dev)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      payload = await r.json();
    } catch (e) {
      await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)));
      if (attempt === 2) fails.push(`${sp.name}（${e.message}）`);
    }
  }
  if (!payload) continue;
  const wt = payload?.parse?.wikitext ?? '';
  const picked = pickDex(wt);
  if (!picked) { fails.push(`${sp.name}（页面里没有图鉴模板）`); continue; }
  raw[slug] = { name: sp.name, ...picked };
  done += 1;
  if (done % 20 === 0) {
    await fs.writeFile(RAW, JSON.stringify(raw, null, 2) + '\n', 'utf8');
    console.log(`  …${done}/${want.length}`);
  }
  await new Promise((res) => setTimeout(res, 350));   // 别把 wiki 打疼
}

await fs.writeFile(RAW, JSON.stringify(raw, null, 2) + '\n', 'utf8');

const missing = want.filter((s) => !raw[s]?.text);
console.log(`\n抓到了 ${want.length - missing.length}/${want.length}；缓存写入 tools/_species-dex-raw.json`);
if (missing.length) {
  console.log(`缺 ${missing.length} 个（写进 content 时会用敌人自带的「简短介绍」兜底）：`);
  for (const s of missing.slice(0, 20)) console.log(`  ${s} ${species[s]?.name ?? ''}`);
}
if (fails.length) {
  console.log(`\n异常 ${fails.length} 条：`);
  for (const f of fails.slice(0, 20)) console.log('  ' + f);
}

/**
 * 全角数字 / 字母 → 半角。
 *
 * 装饰字体「余繁离形体」里有 ASCII 数字与字母，但**没有全角那一组**
 * （０-９ 与 Ｘ，共 8 个码位）—— 而图鉴文本里真的会出现「组成约１０只的群体」这种写法。
 * 不换的话那 8 个字会掉到别的字体上，在一整片花纹里露出几个形状明显不一样的字。
 * 只动全角数字与字母，**标点一律不碰**（，、。这些是 U+FF0C / U+3001，换掉就成英文标点了）。
 */
const toHalfWidth = (s) => String(s).replace(
  /[\uff10-\uff19\uff21-\uff3a\uff41-\uff5a]/g,
  (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0),
);

/** 兜底：wiki 上没取到的，用敌人图鉴里那句手写的「简短介绍」顶上（有字比空着强） */
const intros = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'enemy-intro.json'), 'utf8')).intro;
const dex = {};
let fallback = 0;
for (const slug of want) {
  const t = raw[slug]?.text;
  if (t) dex[slug] = toHalfWidth(t);
  else {
    const byId = enemies.find((e) => e.slug === slug)?.id;
    const f = (bySlugIntro(slug) ?? (byId ? intros[byId] : '')) || '';
    if (f) { dex[slug] = f; fallback += 1; }
  }
}
function bySlugIntro(slug) {
  for (const [id, text] of Object.entries(intros)) {
    if (enemies.find((e) => e.id === id)?.slug === slug) return text;
  }
  return null;
}

const doc = {
  _note: '战斗背景那层波浪花纹文字的文本（**简体中文**，取自 52wiki / wiki.52poke.com 的「图鉴介绍」）。'
    + '它是**图案不是内容**，用户明确说过「日文和英文的背景文本都不用本地化，因为只是做个图案」，'
    + '所以这份文本**故意不登记进 CONTENT_FIELDS**、不进多语言清单（见 check-content 的 SKIP 说明）。'
    + '上下两半各铺一份：上半是这一场敌人的物种，下半是主角的物种（见 ui/battle-view.js 的 battleDecor）。'
    + '字体用仓库根目录的「余繁离形体.otf」裁出来的子集（tools/subset-fonts.mjs 的 decor 那一组）。'
    + '由 tools/fetch-species-dex.mjs 抓取生成 —— 要改文本就改那个脚本再跑一遍。',
  dex,
};
await fs.writeFile(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
console.log(`\ncontent/species-dex.json：${Object.keys(dex).length} 条` + (fallback ? `（其中 ${fallback} 条用了「简短介绍」兜底）` : ''));
console.log('接着跑：node tools/build-content.mjs && node tools/subset-fonts.mjs');
