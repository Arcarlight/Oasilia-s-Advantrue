// 敌人挑选的回归测试：**同一局里不重复**（用户要求）。
//
// 起因：「现在出现很多宝可梦重复，要求不能有重复出现的敌方宝可梦。」
// 量出来（tools/measure-enemy-repeat.mjs）：改之前 **100%** 的局都会撞见重复物种，
// 平均每局 7.2 场重复；改完之后掉到 22%（剩下的靠内容扩充解决 —— 池子不够大时无解）。
//
// 这里钉住的是**规则本身**：有新鲜的就绝不重复、没新鲜的了才允许重复、
// 账本要能存档读档、结局首领不会被「本局没见过」的规则顶掉。
//
//   node tools/test-enemy-pick.mjs
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const { Game } = await import('../src/core/game.js');
const { ENEMY_BY_ID } = await import('../src/data/enemies.js');
const { stageCount } = await import('../src/data/mapgen.js');
const { BIOMES } = await import('../src/data/balance.js');

const fails = [];
const ok = (cond, label, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails.push(label);
};

console.log('敌人挑选（同一局不重复）回归测试：');

// ---------- ① 有新鲜的就绝不重复 ----------
{
  const g = new Game({ seed: 4242 });
  g.newRun(4242);
  const biome = g.data.map.biome;
  const pool = g.pickEnemyDef ? null : null;
  // 反复抽：直到池子里的物种都被抽过一遍为止，全程不许出现第二次
  const seen = new Map();
  let dup = 0;
  let rounds = 0;
  while (rounds++ < 60) {
    const def = g.rollEnemyFor('normal');
    const n = (seen.get(def.slug) ?? 0) + 1;
    seen.set(def.slug, n);
    if (n > 1) dup += 1;
    // 池子抽干了就停（下一轮开始必然重复）
    const exhausted = [...new Set(g.data.metEnemies.map((id) => ENEMY_BY_ID[id].slug))].length;
    const { poolFor } = await import('../src/data/enemies.js');
    const size = new Set(poolFor(biome, 'normal').concat(poolFor(biome, 'mob')).map((e) => e.slug)).size;
    if (exhausted >= size) break;
  }
  ok(dup === 0, '同一个物种在「还有新面孔」时不会被抽第二次', `抽了 ${rounds} 次，重复 ${dup} 次`);

  // 池子抽干之后：允许重复，但不能崩、不能返回空
  let after = null;
  let threw = false;
  try { after = g.rollEnemyFor('normal'); } catch { threw = true; }
  ok(!threw && !!after && !!ENEMY_BY_ID[after.id], '池子抽干之后仍然抽得到（允许重复，但不许开天窗）',
    after?.name ?? 'null');
}

// ---------- ② 账本存档往返 ----------
{
  localStorage._m.delete('oasis_desert_spirit_save_v1');
  const g = new Game({ seed: 777 });
  g.newRun(777);
  const first = g.rollEnemyFor('normal');
  g.save();
  const reloaded = new Game({ seed: 1 });
  const okLoad = reloaded.loadFromData(JSON.parse(localStorage._m.get('oasis_desert_spirit_save_v1')).data);
  ok(okLoad && (reloaded.data.metEnemies ?? []).includes(first.id),
    '「这一局见过谁」的账本会跟着存档走', `${(reloaded.data.metEnemies ?? []).join(',')}`);
  const again = reloaded.rollEnemyFor('normal');
  ok(again.slug !== first.slug, '读档之后也不会把刚打过的那只再抽一次',
    `${first.slug} → ${again.slug}`);
}

// ---------- ③ 老存档没有这个字段也不能炸 ----------
{
  const g = new Game({ seed: 99 });
  g.newRun(99);
  delete g.data.metEnemies;
  let def = null; let threw = false;
  try { def = g.rollEnemyFor('elite'); } catch { threw = true; }
  ok(!threw && !!def, '老存档（没有 metEnemies）照样抽得出来', def?.name ?? '');
  ok(Array.isArray(g.data.metEnemies) && g.data.metEnemies.length === 1, '顺手把账本补上', `${g.data.metEnemies?.length}`);
}

// ---------- ④ 结局首领不会被顶掉 ----------
{
  const g = new Game({ seed: 31337 });
  g.newRun(31337);
  const { generateMap } = await import('../src/data/mapgen.js');
  g.data.stage = stageCount() - 1;
  // 必须把地图也切到最后一张：结局首领是**那张图**的首领（第一次写这条测试时忘了切图，
  // 于是它拿沙漠的首领池去验「有没有 final」，报了个假失败）
  g.data.map = generateMap(g.data.stage, g.rng, g.data.biomes[g.data.stage]);
  // 先在最后一张图里把首领都「见过」一遍，模拟极端情况
  const { poolFor } = await import('../src/data/enemies.js');
  const finals = poolFor(g.data.map.biome, 'boss').filter((b) => b.final);
  ok(finals.length === 1, '最后一张图有且只有一个「结局首领」', finals.map((b) => b.name).join('、'));
  for (const b of poolFor(g.data.map.biome, 'boss')) g.data.metEnemies.push(b.id);
  g.startBattle('boss', 0, 'direct');
  const def = g.battleContext.enemyDef;
  ok(!!def?.final, '最后一张图的首领仍然是「结局首领」（final）', `${def?.name}（final=${!!def?.final}）`);
}

// ---------- ⑤ 一局之内：物种 vs 条目 ----------
{
  const g = new Game({ seed: 5150 });
  g.newRun(5150);
  // 同一只宝可梦占两条（不同 id）时，也要算「同一只」
  const { ENEMIES } = await import('../src/data/enemies.js');
  const twin = ENEMIES.find((e) => ENEMIES.some((o) => o.id !== e.id && o.slug === e.slug && o.biome === e.biome));
  if (twin) {
    const other = ENEMIES.find((o) => o.id !== twin.id && o.slug === twin.slug && o.biome === twin.biome);
    g.data.metEnemies = [other.id];
    // 把地图切到这一对所在的那张图
    const { generateMap } = await import('../src/data/mapgen.js');
    const { BIOME_SLOTS } = await import('../src/data/balance.js');
    const stage = (BIOME_SLOTS[twin.biome] ?? [0])[0];
    g.data.stage = stage;
    g.data.map = generateMap(stage, g.rng, twin.biome);
    const def = g.rollEnemyFor(twin.tier === 'boss' ? 'boss' : twin.tier === 'elite' ? 'elite' : 'normal');
    ok(def.slug !== twin.slug, '同一物种的另一条（换个 id）也算「已经见过」', `${def.name}`);
  } else {
    ok(true, '（这一版内容里没有「同一张图里同物种占两条」的情况）');
  }
}

// ---------- ⑥ 内容侧的缺口（**量出来**，不是在这里判红） ----------
/**
 * 规则能保证「有新鲜的就绝不重复」，但**池子不够大时无解** ——
 * 一章最多 9 场战斗（实测 p100），某张图的杂兵+较强池子只有 8 只时，抽到第 9 场必然重复。
 * 这两项是内容侧的缺口，用 tools/measure-enemy-repeat.mjs 量（它会打印每张图还差几只、
 * 以及一局里还有多少重复）；等名单扩充完，再在 check-content 里升级成硬门禁。
 */
{
  const { poolFor, ENEMIES } = await import('../src/data/enemies.js');
  const lines = [];
  let short = 0;
  let shortTotal = 0;
  for (const key of Object.keys(BIOMES)) {
    const slots = new Set(poolFor(key, 'mob').concat(poolFor(key, 'normal')).map((e) => e.slug)).size;
    if (slots < 12) { short += 1; shortTotal += 12 - slots; }
    lines.push(`${BIOMES[key].name} ${slots}`);
  }
  const dupSpecies = ENEMIES.length - new Set(ENEMIES.map((e) => e.slug)).size;
  console.log(`  · 内容缺口（要靠扩充名单解决，不是这条测试管的）：`
    + `${short} 张图的池子不足 12 只（合计还差 ${shortTotal} 个空位）｜`
    + `${dupSpecies} 条是「同一物种占多条」`);
  console.log(`    ${lines.join(' / ')}`);
}

if (fails.length) {
  console.error(`\n敌人挑选回归测试：失败 ${fails.length} 条`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('\n敌人挑选回归测试：全部通过');
