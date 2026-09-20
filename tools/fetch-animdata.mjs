// 抓 SpriteCollab 的 AnimData.xml（每个物种一份，按图鉴编号）。
//
// 为什么需要它：`assets/data/sprites.json` 里每张精灵表的**帧宽 / 帧高**是从
// AnimData.xml 读出来的。这份缓存一旦缺一个物种，`build-sprite-meta.mjs` 就只能
// 「猜」帧尺寸 —— 而猜出来的值会让一格里塞进两帧（画面上就是两只宝可梦并排跳），
// 或者整张表被当成一帧（一堆小精灵铺满屏幕）。
//
// 这正是**扩内容时踩的坑**：本作从 96 只扩到 112 只时新加了 17 只，
// 而这份缓存是照着当年的物种表抓的 —— 那 17 只没有 AnimData，
// 于是赤面龙 / 电龙 / 小碎钻… 的行走图全是坏的（用户反馈）。
// 所以改成**按 content/species.json 跑**：缺哪只抓哪只，加了新物种重跑一次就行。
//
//   node tools/fetch-animdata.mjs            # 只补缺的
//   node tools/fetch-animdata.mjs --force    # 全部重抓
//
// 本机直连 GitHub 不通，要走代理：
//   $env:NODE_USE_ENV_PROXY=1; $env:HTTPS_PROXY="http://127.0.0.1:7897"; node tools/fetch-animdata.mjs
//
// 抓完必须跑 `node tools/build-sprite-meta.mjs` 重算 sprites.json（check-content 会盯着这条）。
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'tools', 'animdata-cache');
const BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite';
const FORCE = process.argv.includes('--force');
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const species = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'species.json'), 'utf8')).species;
// 主角物种不一定登记在 species.json 里，但它的精灵图也要有帧信息
const { BALANCE } = await import('../src/data/balance.js');
if (!species[BALANCE.player.species]) {
  species[BALANCE.player.species] = { dex: BALANCE.player.dex, name: BALANCE.player.speciesName };
}

await fs.mkdir(CACHE, { recursive: true });
const dexOf = (slug) => String(species[slug].dex).padStart(4, '0');

const targets = Object.entries(species).filter(([slug]) => !ONLY.length || ONLY.includes(slug));
let ok = 0; let skip = 0; const failed = [];
console.log(`要处理 ${targets.length} 只${ONLY.length ? `（只跑：${ONLY.join(' ')}）` : ''}`);

for (const [slug] of targets) {
  const dex = dexOf(slug);
  const dst = path.join(CACHE, `${dex}.xml`);
  if (!FORCE && (await fs.stat(dst).catch(() => null))?.size > 100) { skip += 1; continue; }
  let done = false;
  for (let attempt = 0; attempt < 3 && !done; attempt += 1) {
    try {
      const r = await fetch(`${BASE}/${dex}/AnimData.xml`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      if (!/<Anim>/.test(text)) throw new Error('内容不像 AnimData');
      await fs.writeFile(dst, text, 'utf8');
      const anims = [...text.matchAll(/<Name>([^<]+)<\/Name>/g)].map((m) => m[1]);
      console.log(`  ✓ ${slug.padEnd(12)} ${dex} —— ${anims.length} 个动画（${anims.slice(0, 4).join('/')}…）`);
      ok += 1; done = true;
    } catch (e) {
      if (attempt === 2) { console.log(`  ✗ ${slug.padEnd(12)} ${dex} : ${e.message}`); failed.push(`${slug}(${dex})`); }
      else await new Promise((r) => setTimeout(r, 500));
    }
  }
}
console.log(`AnimData：新抓 ${ok}｜已有 ${skip}｜失败 ${failed.length}${failed.length ? ' —— ' + failed.join('、') : ''}`);
if (failed.length) process.exitCode = 1;
else if (ok) console.log('接着跑：node tools/build-sprite-meta.mjs');
