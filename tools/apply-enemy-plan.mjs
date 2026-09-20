// 把「敌方名单设计表」（content/_enemy-plan.json）落到内容数据上。
//
// 分为两步，可以分开跑：
//   node tools/apply-enemy-plan.mjs species     # 只把设计表里还没有的物种补进 content/species.json
//   node tools/apply-enemy-plan.mjs enemies     # 按设计表重写 content/enemies.json（见下面 TODO）
//   node tools/apply-enemy-plan.mjs check       # 只校验设计表（位置数 / 唯一性 / 池子大小 / 世代）
//
// 为什么要有它：这份名单是**按主题 + 世代挑的**（用户要求：「不能有重复出现的敌方宝可梦」
// 「为什么怪力会出现在墓地？有任何关系吗？」「不要全部选第一世代的，后面也要选」），
// 手改 170 条 JSON 既容易漏也说不清改动，用脚本从设计表生成才能对账。
//
// 物种名一律来自 tools/_new-species.json（PokeAPI 的英文 / 日文 + 52poke 的官方中文名），
// 见 tools/fetch-species-names.mjs —— **不许手写**，我凭印象猜过两个：Nacli 以为是「晶光芽」
// （实际「盐石宝」）、Runerigus 以为是「死神板」（实际「迭失板」）。
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'check';
const TIERS = ['mob', 'normal', 'elite', 'boss'];

const plan = JSON.parse(await fs.readFile(path.join(ROOT, 'content', '_enemy-plan.json'), 'utf8'));
const speciesFile = path.join(ROOT, 'content', 'species.json');
const species = JSON.parse(await fs.readFile(speciesFile, 'utf8'));
const names = JSON.parse(await fs.readFile(path.join(ROOT, 'tools', '_new-species.json'), 'utf8').catch(() => '{}'));

/** 设计表里的全部位置：[{biome, tier, dex}] */
function planSlots() {
  const out = [];
  for (const [biome, b] of Object.entries(plan.biomes)) {
    for (const tier of TIERS) for (const dex of b[tier] ?? []) out.push({ biome, tier, dex: Number(dex) });
  }
  return out;
}

function check() {
  const problems = [];
  const slots = planSlots();
  const byDex = new Map();
  for (const s of slots) byDex.set(s.dex, (byDex.get(s.dex) ?? 0) + 1);
  for (const [dex, n] of byDex) if (n > 1) problems.push(`图鉴号 ${dex} 在名单里出现 ${n} 次`);
  for (const [biome, b] of Object.entries(plan.biomes)) {
    for (const tier of TIERS) {
      if ((b[tier] ?? []).length !== plan.targets[tier]) {
        problems.push(`${biome}/${tier} 有 ${(b[tier] ?? []).length} 个，目标是 ${plan.targets[tier]}`);
      }
    }
    const pool = (b.mob ?? []).length + (b.normal ?? []).length;
    if (pool < 12) problems.push(`${biome} 的杂兵+较强只有 ${pool} 只（一章最多 9 场战斗，要 ≥12）`);
  }
  const missing = slots.filter((s) => !Object.values(species.species).some((r) => Number(r.dex) === s.dex));
  if (missing.length) problems.push(`有 ${missing.length} 个位置对应的物种还没进 species.json：${missing.map((m) => m.dex).join(' ')}`);

  console.log(`设计表：${slots.length} 个位置 ｜ 涉及物种 ${byDex.size} 个 ｜ 其中已进 species.json 的 ${slots.length - missing.length} 个`);
  if (problems.length) {
    console.error(`\n发现 ${problems.length} 个问题：\n  ` + problems.join('\n  '));
    process.exitCode = 1;
  } else {
    console.log('设计表自检通过 ✓');
  }
}

async function applySpecies() {
  const bySlug = { ...species.species };
  let added = 0;
  for (const s of planSlots()) {
    const existing = Object.values(bySlug).find((r) => Number(r.dex) === s.dex);
    if (existing) continue;
    const rec = names[s.dex] ?? names[String(s.dex)];
    if (!rec?.zh) { console.warn(`  跳过 ${s.dex}：tools/_new-species.json 里没有它的名字`); continue; }
    bySlug[rec.slug] = { dex: rec.dex, slug: rec.slug, name: rec.zh, en: rec.en, types: rec.types };
    added += 1;
  }
  const sorted = {};
  for (const [slug, rec] of Object.entries(bySlug).sort((a, b) => Number(a[1].dex) - Number(b[1].dex))) sorted[slug] = rec;
  species.species = sorted;
  await fs.writeFile(speciesFile, `${JSON.stringify(species, null, 2)}\n`, 'utf8');
  console.log(`species.json：新增 ${added} 个物种，现在共 ${Object.keys(sorted).length} 个`);
}

if (mode === 'species') await applySpecies();
else if (mode === 'check') check();
else if (mode === 'enemies') {
  console.log('TODO：按设计表重写 content/enemies.json（档位 / 招式包 / 专属招式沿用现有的，只换物种与台词）');
  process.exitCode = 1;
} else {
  console.error(`不认识的方式：${mode}（可用：species / enemies / check）`);
  process.exitCode = 1;
}
