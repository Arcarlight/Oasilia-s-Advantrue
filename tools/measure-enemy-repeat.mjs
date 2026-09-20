// 敌人重复率实测：一局里会不会撞见同一只宝可梦。
//
//   node tools/measure-enemy-repeat.mjs            # 现在的规则（同一局不重复）
//   node tools/measure-enemy-repeat.mjs old        # 改之前的规则（有放回随机抽）
//   node tools/measure-enemy-repeat.mjs 500        # 换局数
//
// 起因（用户要求）：「现在出现很多宝可梦重复，要求不能有重复出现的敌方宝可梦。」
// 所以这里要量三件事，而不是凭感觉：
//   ① 一局里**重复见过同一物种**的局占多少（这是玩家实际感受到的那个数）；
//   ② 一章之内就重复的比例（最刺眼的那种）；
//   ③ 同一只条目（id）被抽到两次的比例。
// 做法是**只抽不打**：按地图真的走一条路，走到战斗 / 精英 / 首领节点就调
// `game.rollEnemyFor(kind)`（startBattle 用的就是它），打完首领就进下一章。
import { promises as fs } from 'node:fs';

globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const { Game } = await import('../src/core/game.js');
const { ENEMY_BY_ID, ENEMIES, poolFor } = await import('../src/data/enemies.js');
const { startNodes, nextNodes } = await import('../src/data/mapgen.js');
const { stageCount } = await import('../src/data/mapgen.js');

const args = process.argv.slice(2);
const OLD = args.includes('old');
const RUNS = Number(args.find((a) => /^\d+$/.test(a)) ?? 300);

/** 一局里走一遍地图，把每一次遭遇的敌人记下来（不真的打） */
function walkRun(seed) {
  const g = new Game({ seed });
  g.newRun(seed);
  if (OLD) {
    // 改之前：有放回地随机抽（这里照抄当时的写法）
    g.rollEnemyFor = function oldRoll(kind) {
      const biome = this.data.map.biome;
      let pool;
      if (kind === 'boss') {
        const bosses = poolFor(biome, 'boss');
        const isFinal = this.data.stage >= stageCount() - 1;
        const chosen = isFinal ? bosses.find((b) => b.final) : null;
        const def = chosen ?? (isFinal ? bosses[0] : this.rng.pick(bosses));
        if (def) (this.data.metEnemies ??= []).push(def.id);
        return def;
      }
      if (kind === 'elite') pool = poolFor(biome, 'elite').length ? poolFor(biome, 'elite') : poolFor(biome, 'normal');
      else pool = poolFor(biome, 'normal').concat(poolFor(biome, 'mob'));
      const def = this.rng.pick(pool);
      (this.data.metEnemies ??= []).push(def.id);
      return def;
    };
  }

  const encounters = [];   // { id, slug, chapter, kind }
  for (let chapter = 0; chapter < stageCount(); chapter += 1) {
    let nodeId = null;
    for (let step = 0; step < 40; step += 1) {
      const nodes = nodeId ? nextNodes(g.data.map, nodeId) : startNodes(g.data.map);
      if (!nodes.length) break;
      const node = g.rng.pick(nodes);
      nodeId = node.id;
      const kind = node.type === 'boss' ? 'boss' : node.type === 'elite' ? 'elite' : node.type === 'battle' ? 'normal' : null;
      if (kind) {
        const def = g.rollEnemyFor(kind);
        if (def) encounters.push({ id: def.id, slug: def.slug, chapter, kind });
      }
      if (node.type === 'boss') { g.nextStage(); break; }
    }
    if (g.phase === 'victory') break;
  }
  return encounters;
}

const runs = [];
for (let i = 0; i < RUNS; i += 1) runs.push(walkRun(90001 + i * 7919));

let dupSpeciesRuns = 0; let dupInChapterRuns = 0; let dupIdRuns = 0;
let totalEncounters = 0; let totalDupSpecies = 0;
const perRunDup = [];
for (const enc of runs) {
  totalEncounters += enc.length;
  const bySpecies = new Map(); const byId = new Map(); const byChapterSpecies = new Map();
  let dupSpecies = 0;
  for (const e of enc) {
    bySpecies.set(e.slug, (bySpecies.get(e.slug) ?? 0) + 1);
    byId.set(e.id, (byId.get(e.id) ?? 0) + 1);
    const key = `${e.chapter}/${e.slug}`;
    byChapterSpecies.set(key, (byChapterSpecies.get(key) ?? 0) + 1);
  }
  for (const n of bySpecies.values()) if (n > 1) dupSpecies += n - 1;
  totalDupSpecies += dupSpecies;
  perRunDup.push(dupSpecies);
  if (dupSpecies) dupSpeciesRuns += 1;
  if ([...byChapterSpecies.values()].some((n) => n > 1)) dupInChapterRuns += 1;
  if ([...byId.values()].some((n) => n > 1)) dupIdRuns += 1;
}

const pct = (n) => `${((n / runs.length) * 100).toFixed(1)}%`;
console.log(`敌人重复率实测（${OLD ? '改之前：有放回随机抽' : '现在的规则：同一局不重复'}，${runs.length} 局）`);
console.log(`  每局遭遇次数：平均 ${(totalEncounters / runs.length).toFixed(1)} 场`);
console.log(`  一局里撞见重复物种的局：${pct(dupSpeciesRuns)}（${dupSpeciesRuns}/${runs.length}）`);
console.log(`  …其中「同一章内就重复」的局：${pct(dupInChapterRuns)}（${dupInChapterRuns}/${runs.length}）`);
console.log(`  同一只条目被抽到两次的局：${pct(dupIdRuns)}（${dupIdRuns}/${runs.length}）`);
console.log(`  平均每局重复场次：${(totalDupSpecies / runs.length).toFixed(2)} 场`);

/**
 * 重复到底发生在哪儿 —— 只报总数是没法修的。
 * 按「第几章」和「哪一档」拆开：章内重复说明这一章的池子不够大（内容问题），
 * 跨章重复说明同一物种占了多张图（内容问题），而档位那一栏能直接指出是杂兵还是精英抽干了。
 */
{
  const dupByChapter = new Map();
  const dupByKind = new Map();
  const dupByBiome = new Map();
  for (const enc of runs) {
    const seen = new Map();
    for (const e of enc) {
      const n = (seen.get(e.slug) ?? 0) + 1;
      seen.set(e.slug, n);
      if (n > 1) {
        dupByChapter.set(e.chapter + 1, (dupByChapter.get(e.chapter + 1) ?? 0) + 1);
        dupByKind.set(e.kind, (dupByKind.get(e.kind) ?? 0) + 1);
        const key = `${e.slug}@${e.id}`;
        dupByBiome.set(key, (dupByBiome.get(key) ?? 0) + 1);
      }
    }
  }
  const fmt = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`  重复发生在第几章：${fmt(dupByChapter) || '无'}`);
  console.log(`  重复发生在哪一档：${fmt(dupByKind) || '无'}`);
  console.log(`  重复最多的几只：${[...dupByBiome.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}×${v}`).join(' ') || '无'}`);
}

// 每一章的「本图杂兵+较强」池子有多大 —— 池子小于一章的战斗数，就必然抽干、必然重复
{
  const { BIOMES } = await import('../src/data/balance.js');
  const lines = [];
  for (const key of Object.keys(BIOMES)) {
    const mob = poolFor(key, 'mob').length;
    const normal = poolFor(key, 'normal').length;
    const elite = poolFor(key, 'elite').length;
    lines.push(`${BIOMES[key].name} ${mob}+${normal}=${mob + normal}（精英 ${elite}）`);
  }
  console.log(`\n各图的池子：${lines.join(' ｜ ')}`);
}

// 顺便把「内容里同一物种占多条」的情况列出来 —— 这一条只在老规则下会变成重复遭遇
const bySlug = new Map();
for (const e of ENEMIES) {
  if (!bySlug.has(e.slug)) bySlug.set(e.slug, []);
  bySlug.get(e.slug).push(e.id);
}
const multi = [...bySlug].filter(([, v]) => v.length > 1);
console.log(`\n内容盘点：${ENEMIES.length} 条敌人只对应 ${bySlug.size} 个物种，其中 ${multi.length} 个物种占了多条：`);
for (const [slug, ids] of multi.sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${slug} ×${ids.length}：${ids.map((i) => `${i}(${ENEMY_BY_ID[i].tier}/${ENEMY_BY_ID[i].biome})`).join(' ')}`);
}
