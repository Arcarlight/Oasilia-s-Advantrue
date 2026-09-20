// 从 PokeAPI + 52poke 神奇宝贝百科取「设计表里那些物种」的官方名字与属性，
// 落到 tools/_new-species.json 里。
//
// 为什么分两个来源：
//   · PokeAPI 给英文名 / 日文名 / 属性 —— 权威且完整；
//   · **中文名它给不全**（G8 / G9 一大批是 null，实测 73 只里一个都没有），
//     所以中文名去 52poke 神奇宝贝百科按英文名查页面标题（宝可梦译名以它为准）。
// 手写是绝对不行的：我凭印象猜「Nacli = 晶光芽」，实际是**盐石宝**；
// 猜「Runerigus = 死神板」，实际是**迭失板**。
//
//   $env:NODE_USE_ENV_PROXY="1"; $env:HTTPS_PROXY="http://127.0.0.1:7897"; node tools/fetch-species-names.mjs
//
// 输出：tools/_new-species.json —— { "<dex>": { dex, slug, zh, en, ja, types, gen } }
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = JSON.parse(await fs.readFile(path.join(ROOT, 'content', '_enemy-plan.json'), 'utf8'));

/** 设计表里出现过的所有图鉴号 */
const dexes = new Set();
for (const b of Object.values(plan.biomes)) {
  for (const tier of ['mob', 'normal', 'elite', 'boss']) for (const d of b[tier] ?? []) dexes.add(Number(d));
}

const TYPE_ZH = {
  normal: '一般', fire: '火', water: '水', electric: '电', grass: '草', ice: '冰',
  fighting: '格斗', poison: '毒', ground: '地面', flying: '飞行', psychic: '超能',
  bug: '虫', rock: '岩石', ghost: '幽灵', dragon: '龙', dark: '恶', steel: '钢', fairy: '妖精',
};
const genOf = (d) => {
  if (d <= 151) return 1; if (d <= 251) return 2; if (d <= 386) return 3; if (d <= 493) return 4;
  if (d <= 649) return 5; if (d <= 721) return 6; if (d <= 809) return 7; if (d <= 905) return 8;
  return 9;
};

const OUT = path.join(ROOT, 'tools', '_new-species.json');
let cache = {};
try { cache = JSON.parse(await fs.readFile(OUT, 'utf8')); } catch { /* 第一次跑 */ }

/** 既有的 species.json 里已经有这些图鉴号，就不用再抓 */
const existing = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'species.json'), 'utf8')).species;
const haveDex = new Set(Object.values(existing).map((s) => Number(s.dex)));

const need = [...dexes].filter((d) => !haveDex.has(d) && !cache[d]).sort((a, b) => a - b);
// 缓存里有、但中文名还空着的（上一次跑被 wiki 限速打回来的）：这次只补中文名
const needZh = [...dexes].filter((d) => !haveDex.has(d) && cache[d] && !cache[d].zh).sort((a, b) => a - b);
console.log(`设计表里一共 ${dexes.size} 个图鉴号；已有 ${dexes.size - [...dexes].filter((d) => !haveDex.has(d)).length} 个在 species.json 里；`
  + `这次要抓 ${need.length} 个${need.length ? '：' + need.join(' ') : ''}`
  + `${needZh.length ? `；另有 ${needZh.length} 个只补中文名` : ''}`);

const getJson = async (url) => {
  for (let i = 0; i < 3; i += 1) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((res) => setTimeout(res, 400));
    }
  }
};

/**
 * 52poke 神奇宝贝百科：拿英文名去查页面标题，页面标题就是**官方中文名**。
 * 抓不到就返回 null（写进结果里，回头人工补），绝不拿英文名凑数 —— 那会静默留下一个英文「中文名」。
 *
 * **必须串行 + 限速**：wiki 对并发很不客气（实测 6 并发立刻一片 HTTP 429），
 * 所以这里排成一条链，每次之间歇 350ms，429 时退避重试。
 */
let wikiChain = Promise.resolve();
let wikiCount = 0;
function zhNameFrom52poke(en) {
  const run = async () => {
    for (let i = 0; i < 4; i += 1) {
      try {
        const r = await fetch(`https://wiki.52poke.com/wiki/${encodeURIComponent(en)}`, {
          headers: { 'User-Agent': 'oasis-fan-game/1.0 (fan project; name lookup)' },
        });
        if (r.status === 429) throw new Error('HTTP 429');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const html = await r.text();
        const m = html.match(/<h1[^>]*id="firstHeading"[^>]*>([\s\S]*?)<\/h1>/);
        const title = m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
        wikiCount += 1;
        // 标题里可能带消歧义后缀（「…（动画）」之类），去掉括号
        return title.replace(/[（(][^）)]*[）)]\s*$/, '') || null;
      } catch (e) {
        if (i === 3) { console.warn(`    （52poke 查不到 ${en}：${e.message}）`); return null; }
        await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
      }
    }
    return null;
  };
  // 排进串行链：每次跑完歇一下再跑下一个
  const next = wikiChain.then(async () => {
    const out = await run();
    await new Promise((res) => setTimeout(res, 350));
    return out;
  });
  wikiChain = next.catch(() => {});
  return next;
}

// 并发 6：PokeAPI / 52poke 都很快，但串行 70 多只也要几分钟
let done = 0;
const queue = [...need];
const worker = async () => {
  while (queue.length) {
    const dex = queue.shift();
    const id = String(dex).padStart(4, '0');
    const [sp, mon] = await Promise.all([
      getJson(`https://pokeapi.co/api/v2/pokemon-species/${dex}`),
      getJson(`https://pokeapi.co/api/v2/pokemon/${dex}`),
    ]);
    const nameIn = (lang) => sp.names.find((n) => n.language.name === lang)?.name ?? null;
    const slug = (sp.name ?? '').toLowerCase();
    const types = mon.types.sort((a, b) => a.sort - b.sort || a.slot - b.slot).map((t) => TYPE_ZH[t.type.name] ?? t.type.name);
    const en = nameIn('en');
    // 中文名：先看 PokeAPI（老世代它是有数据的），没有就去 52poke 查页面标题
    let zh = nameIn('zh-Hans') ?? nameIn('zh-Hant');
    if (!zh && en) zh = await zhNameFrom52poke(en);
    cache[dex] = {
      dex: id, slug,
      zh, en,
      ja: nameIn('ja-Hrkt') ?? nameIn('ja'),
      types, gen: genOf(dex),
    };
    done += 1;
    console.log(`  ${String(done).padStart(2)}/${need.length} ${id} ${cache[dex].zh ?? '?'}/${en}/${cache[dex].ja} ${types.join('/')}`);
  }
};
await Promise.all(Array.from({ length: 6 }, worker));

// 只补中文名的那一批（串行 + 限速，所以单独一段）
if (needZh.length) {
  console.log(`补中文名（串行，共 ${needZh.length} 只）…`);
  for (const dex of needZh) {
    cache[dex].zh = await zhNameFrom52poke(cache[dex].en);
    console.log(`  ${cache[dex].dex} ${cache[dex].en} → ${cache[dex].zh ?? '✗'}`);
  }
}

const sorted = {};
for (const k of Object.keys(cache).sort((a, b) => Number(a) - Number(b))) sorted[k] = cache[k];
await fs.writeFile(OUT, `${JSON.stringify(sorted, null, 1)}\n`, 'utf8');
console.log(`写进 tools/_new-species.json（${Object.keys(sorted).length} 条）`);
// 只报「既不在 species.json、也没抓到」的那些（已经在本作里的当然不用再抓）
const missing = [...dexes].filter((d) => !haveDex.has(d) && !cache[d]?.zh);
if (missing.length) { console.log(`⚠ 还缺中文名的：${missing.join(' ')}`); process.exitCode = 1; }
else console.log('设计表里要新加的物种，中文名都拿到了 ✓');
