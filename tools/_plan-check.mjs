// 一次性脚本：校验 content/_enemy-plan.json（敌方名单的设计表）并打印它现在的样子。
// 用法: node tools/_plan-check.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = JSON.parse(await fs.readFile(path.join(ROOT, 'content', '_enemy-plan.json'), 'utf8'));
const species = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'species.json'), 'utf8')).species;
const { ENEMIES } = await import('../src/data/enemies.js');

/** 现有物种：图鉴号 → slug */
const knownByDex = new Map();
for (const [slug, s] of Object.entries(species)) knownByDex.set(Number(s.dex), slug);
const enemySpecies = new Set(ENEMIES.map((e) => e.slug));

const genOf = (dex) => {
  const d = Number(dex);
  if (d <= 151) return 1; if (d <= 251) return 2; if (d <= 386) return 3; if (d <= 493) return 4;
  if (d <= 649) return 5; if (d <= 721) return 6; if (d <= 809) return 7; if (d <= 905) return 8;
  return 9;
};

const all = [];
const problems = [];
const genTally = {};
const genByBiome = {};
let kept = 0; let fresh = 0;

for (const [key, b] of Object.entries(plan.biomes)) {
  const tierCounts = {};
  genByBiome[key] = {};
  for (const tier of ['mob', 'normal', 'elite', 'boss']) {
    const list = b[tier] ?? [];
    tierCounts[tier] = list.length;
    if (list.length !== plan.targets[tier]) {
      problems.push(`${key}/${tier} 有 ${list.length} 个，目标是 ${plan.targets[tier]}`);
    }
    for (const dex of list) {
      all.push({ key, tier, dex });
      const g = genOf(dex);
      genTally[g] = (genTally[g] ?? 0) + 1;
      genByBiome[key][g] = (genByBiome[key][g] ?? 0) + 1;
      const slug = knownByDex.get(Number(dex));
      if (slug) { if (enemySpecies.has(slug)) kept += 1; else fresh += 1; }
      else fresh += 1;
    }
  }
}

// ① 同一个物种不许出现在两处
const dup = new Map();
for (const e of all) dup.set(e.dex, (dup.get(e.dex) ?? 0) + 1);
for (const [dex, n] of dup) if (n > 1) problems.push(`图鉴号 ${dex} 出现了 ${n} 次`);

// ② 池子够不够大（一章最多 9 场战斗）
for (const [key, b] of Object.entries(plan.biomes)) {
  const pool = (b.mob ?? []).length + (b.normal ?? []).length;
  if (pool < 12) problems.push(`${key} 的杂兵+较强只有 ${pool} 只（要 ≥12，否则一章 9 场必然重复）`);
}

// ③ 世代摊开
for (const [key, m] of Object.entries(genByBiome)) {
  const gens = Object.keys(m).map(Number);
  if (gens.length < 4) problems.push(`${key} 只横跨 ${gens.length} 个世代（要求 ≥4）：G${gens.join('/G')}`);
}

console.log(`设计表：${all.length} 个位置（目标 ${Object.keys(plan.biomes).length * 17}）`);
console.log(`沿用现有敌人物种 ${kept} 个｜**新物种 ${fresh} 个**（要抓素材、写台词、翻译）\n`);
console.log('按世代：' + Object.entries(genTally).sort((a, b) => a[0] - b[0])
  .map(([g, n]) => `G${g}:${n}(${((n / all.length) * 100).toFixed(0)}%)`).join(' '));
console.log('\n每张图：');
for (const [key, b] of Object.entries(plan.biomes)) {
  const gens = Object.entries(genByBiome[key]).sort((a, c) => a[0] - c[0]).map(([g, n]) => `G${g}×${n}`).join(' ');
  console.log(`  ${b.name.padEnd(6)} ${key.padEnd(8)} 杂兵${b.mob.length}+较强${b.normal.length} 精英${b.elite.length} 首领${b.boss.length} ｜ ${gens}`);
  console.log(`          主题：${b.theme}`);
}
console.log(problems.length ? `\n发现 ${problems.length} 个问题：\n  ` + problems.join('\n  ') : '\n设计表自检通过 ✓');
process.exitCode = problems.length ? 1 : 0;
