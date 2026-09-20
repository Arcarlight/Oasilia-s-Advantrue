// 物种名对账：把 content/species.json 里的中文名 / 日文名跟官方来源核一遍。
//
// 起因（用户问）：「你确认是导电飞鼠？」—— 587 Emolga 的官方中文名是**电飞鼠**，
// 而 species.json 里写的是「导电飞鼠」（多了两个字）。名字会直接显示在敌人面板和敌人图鉴上，
// 写错了玩家一眼就看得出来。
//
// 中文名以 52poke 神奇宝贝百科的页面标题为准（本作一直用它），日文名以 PokeAPI 的 ja-Hrkt 为准。
// 这两个都要联网，所以它**不是**门禁（门禁不能联网），是一个随时可跑的对账工具：
//
//   $env:NODE_USE_ENV_PROXY=1; $env:HTTPS_PROXY="http://127.0.0.1:7897"; node tools/verify-species-names.mjs
//   ... node tools/verify-species-names.mjs --write     # 把不一致的直接改掉（只改 52poke / PokeAPI 给得出的）
//
// 跑完记得：node tools/build-content.mjs && node tools/build-i18n.mjs（名字进了两边的表）
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const file = path.join(ROOT, 'content', 'species.json');
const species = JSON.parse(await fs.readFile(file, 'utf8'));

/** 串行 + 限速访问 52poke（它对并发很不客气，6 并发立刻一片 429） */
let chain = Promise.resolve();
function throttled(fn) {
  const next = chain.then(async () => {
    const out = await fn();
    await new Promise((r) => setTimeout(r, 320));
    return out;
  });
  chain = next.catch(() => {});
  return next;
}

async function zhFrom52poke(en) {
  return throttled(async () => {
    for (let i = 0; i < 4; i += 1) {
      try {
        const r = await fetch(`https://wiki.52poke.com/wiki/${encodeURIComponent(en)}`, {
          headers: { 'User-Agent': 'oasis-fan-game/1.0 (fan project; name check)' },
        });
        if (r.status === 429) throw new Error('HTTP 429');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const html = await r.text();
        const m = html.match(/<h1[^>]*id="firstHeading"[^>]*>([\s\S]*?)<\/h1>/);
        const title = m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
        return title.replace(/[（(][^）)]*[）)]\s*$/, '') || null;
      } catch (e) {
        if (i === 3) return { error: e.message };
        await new Promise((r2) => setTimeout(r2, 1000 * (i + 1)));
      }
    }
    return null;
  });
}

async function jaFromPokeapi(dex) {
  try {
    const r = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${Number(dex)}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const n = (lang) => j.names.find((x) => x.language.name === lang)?.name ?? null;
    return n('ja-Hrkt') ?? n('ja');
  } catch (e) {
    return { error: e.message };
  }
}

const list = Object.entries(species.species);
console.log(`核对 ${list.length} 个物种的中文名（52poke）与日文名（PokeAPI）…`);
const badZh = [];
const unknown = [];
let checked = 0;

for (const [slug, rec] of list) {
  const en = rec.en;
  if (!en) { unknown.push(`${slug}（没有英文名，没法查）`); continue; }
  const zh = await zhFrom52poke(en);
  if (zh && typeof zh === 'object' && zh.error) unknown.push(`${slug}/${en}：${zh.error}`);
  else if (!zh) unknown.push(`${slug}/${en}（52poke 没有这个页面标题）`);
  else if (zh !== rec.name) badZh.push(`${slug}（${en}）：现在是「${rec.name}」，官方是「${zh}」`);
  checked += 1;
  if (checked % 25 === 0) console.log(`  …已核对 ${checked}/${list.length}`);
}

// 日文名：本作的日文名放在 content/i18n/ja.json 里（中文名 → 日文名），
// 官方日文名去 PokeAPI 取（ja-Hrkt = 片假名，和游戏里显示的一致）。
const jaDict = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'i18n', 'ja.json'), 'utf8'));
const jaQueue = [...list];
const jaOfficial = new Map();
const jaWorker = async () => {
  while (jaQueue.length) {
    const [slug, rec] = jaQueue.shift();
    const ja = await jaFromPokeapi(rec.dex);
    if (ja && typeof ja === 'string') jaOfficial.set(slug, ja);
  }
};
await Promise.all(Array.from({ length: 6 }, jaWorker));
const badJa = [];
const missingJa = [];
for (const [slug, rec] of list) {
  const official = jaOfficial.get(slug);
  if (!official) continue;
  const ours = jaDict[rec.name];
  if (!ours) { missingJa.push(`${slug}/${rec.name}（ja 表里没有）`); continue; }
  if (ours !== official) badJa.push(`${slug}/${rec.name}：ja 表里是「${ours}」，官方是「${official}」`);
}

console.log(`\n中文名不一致 ${badZh.length} 个：`);
for (const b of badZh) console.log('  ✗ ' + b);
console.log(`日文名不一致 ${badJa.length} 个：`);
for (const b of badJa) console.log('  ✗ ' + b);
if (missingJa.length) {
  console.log(`ja 表里查不到（可能是中文名本身写错了导致的连带）：${missingJa.length} 个`);
  for (const m of missingJa.slice(0, 10)) console.log('  ? ' + m);
}
console.log(`查不到官方名的 ${unknown.length} 个：`);
for (const u of unknown) console.log('  ? ' + u);

if (WRITE && badZh.length) {
  let fixed = 0;
  for (const [slug, rec] of Object.entries(species.species)) {
    const hit = badZh.find((b) => b.startsWith(`${slug}（`));
    if (!hit) continue;
    const official = hit.slice(hit.lastIndexOf('「') + 1, hit.lastIndexOf('」'));
    rec.name = official;
    fixed += 1;
  }
  await fs.writeFile(file, `${JSON.stringify(species, null, 2)}\n`, 'utf8');
  console.log(`\n已改掉 ${fixed} 个中文名（species.json）—— 接着要跑：build-content → build-i18n → check-content`);
}
if (badZh.length || badJa.length) process.exitCode = 1;
