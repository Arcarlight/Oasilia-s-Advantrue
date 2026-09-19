// 随机场景的分布：跑很多局，看「每一章会抽到哪张地图」以及一局里能看到几张不同的图。
//
// 起因（用户需求）：「多添加几个额外场景，可以随机替换 6 关中的中间 4 关」。
// 这张表就是那条规则的实测 —— 首章与终章固定，中间 4 章从候选池里随机抽。
//
// 用法：node tools/measure-biomes.mjs [局数]
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const data = JSON.parse(await fs.readFile(path.join(ROOT, 'content/biomes.json'), 'utf8'));
const stageOrder = data.stageOrder;
const biomes = data.biomes;
const N = Number(process.argv[2] ?? 20000);

const slotsOf = (key) => biomes[key].slots ?? [];
const poolAt = (s) => Object.keys(biomes).filter((k) => slotsOf(k).includes(s));

console.log(`地图 ${Object.keys(biomes).length} 张 · 章节 ${stageOrder.length} 章 · 模拟 ${N} 局\n`);
console.log('章节   候选（随机抽，尽量不重复）                             各图出现概率');
for (let s = 0; s < stageOrder.length; s += 1) {
  const pool = poolAt(s);
  const fixed = pool.length === 1;
  console.log(`第 ${s + 1} 章  ${pool.join(' / ').padEnd(52)} ${fixed ? '固定' : `每张约 ${(100 / pool.length).toFixed(0)}%`}`);
}

// 真跑一遍抽取逻辑（和 game.newRun 同一套：抽到没出现过的优先）
const count = Array.from({ length: stageOrder.length }, () => ({}));
const distinct = {};
let dupRuns = 0;
for (let i = 0; i < N; i += 1) {
  const used = new Set();
  const run = [];
  for (let s = 0; s < stageOrder.length; s += 1) {
    const pool = poolAt(s);
    const fresh = pool.filter((k) => !used.has(k));
    const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh.length : pool.length))];
    run.push(pick);
    used.add(pick);
    count[s][pick] = (count[s][pick] ?? 0) + 1;
  }
  const n = new Set(run).size;
  distinct[n] = (distinct[n] ?? 0) + 1;
  if (n < run.length) dupRuns += 1;
}

console.log('\n实测分布：');
for (let s = 0; s < stageOrder.length; s += 1) {
  const row = Object.entries(count[s]).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${(v / N * 100).toFixed(1)}%`).join('  ');
  console.log(`  第 ${s + 1} 章：${row}`);
}
console.log('\n一局里能看到几张不同的地图：');
for (const [n, v] of Object.entries(distinct).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  console.log(`  ${n} 张：${(v / N * 100).toFixed(1)}%`);
}
console.log(`\n（同一局里出现重复地图的局数：${(dupRuns / N * 100).toFixed(1)}% —— 只在候选池不够时才可能）`);
