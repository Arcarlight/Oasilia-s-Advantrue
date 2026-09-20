// 回归测试：无尽模式 + 地图分叉随章节变化。
//
// 用户要的两件事：
//   ① **无尽模式**：通关一次正片之后解锁的**另一个入口**（不是普通模式的续集），
//      地图岔路更多、敌人更强，目标只有「看能走到第几章」。
//   ② 本体地图**越往后岔路越多，第 3 章最多，之后逐渐收回**（给玩家更多选择）。
//
// 这份测试盯住：
//   · 分叉计划：第 3 章最宽、第 5~6 章回到基线（改坏了立刻红）；
//   · 无尽局：过了第 6 章**不会**进结局页，而是继续开下一章，地图/敌人一路变强；
//   · 无尽局的敌人倍率随章节单调上升（正片温和、之后复利）；
//   · 正片通关会**解锁**无尽模式；普通模式仍然在第 6 章结束（别被无尽改坏）；
//   · 无尽局走完记下「最远到第几章」。
//
// 用法：node tools/test-endless.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const { Game } = await imp('src/core/game.js');
const { generateMap, branchBonusFor, endlessRowBonus, stageCount } = await imp('src/data/mapgen.js');
const { BALANCE } = await imp('src/data/balance.js');
const { makeRng } = await imp('src/core/rng.js');
const { scaleEnemy } = await imp('src/data/enemies.js');
const { ENEMIES } = await imp('src/data/enemies.js');

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass += 1; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`); }
  else { fail += 1; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
};
const group = (n) => console.log(`\n${n}`);

// ---------- ① 分叉计划 ----------
group('① 地图分叉随章节变化（第 3 章最宽，之后收回）');
{
  const plan = BALANCE.map.branchBonusByStage;
  ok(Array.isArray(plan) && plan.length >= stageCount(), '每一章都有分叉加成', JSON.stringify(plan));
  const peak = Math.max(...plan);
  ok(plan.indexOf(peak) === 2, '**第 3 章**的分叉加成最高（用户要求的高峰在第三关）',
    `第 ${plan.indexOf(peak) + 1} 章 +${peak}`);
  ok(plan[0] <= plan[1] && plan[1] <= plan[2], '第 1→3 章是递增的（越往后路越多）', plan.slice(0, 3).join(' → '));
  ok(plan[3] >= plan[4] && plan[4] >= plan[5], '第 4→6 章是递减的（之后逐渐回归）', plan.slice(3).join(' → '));
  ok(plan[plan.length - 1] === plan[0], '最后一章回到第 1 章的宽度（回归）', `${plan[0]} vs ${plan[plan.length - 1]}`);

  // 真的生成出来量一遍：每章的「平均每行几个节点」
  const width = (stage) => {
    const m = generateMap(stage, makeRng(1000 + stage), 'desert');
    const mid = m.nodes.filter((n) => n.row > 0 && n.row < m.rows - 1);
    const rows = new Set(mid.map((n) => n.row));
    return mid.length / rows.size;
  };
  const w = [0, 1, 2, 3, 4, 5].map(width);
  const rounded = w.map((x) => Math.round(x * 100) / 100);
  ok(w[2] > w[0], '实测第 3 章比第 1 章宽', `第 1 章 ${rounded[0]} 个/行 → 第 3 章 ${rounded[2]} 个/行`);
  ok(w[5] <= w[2], '实测最后一章不比第 3 章宽（收回来了）', `第 3 章 ${rounded[2]} → 第 6 章 ${rounded[5]}`);
  console.log(`    · 每章平均每行节点数：${rounded.join(' / ')}（第 1~6 章）`);
}

// ---------- ② 无尽模式的引擎行为 ----------
group('② 无尽局：过了正片继续走，不会进结局');
{
  const g = new Game({ seed: 20260920 });
  g.newRun(20260920, { endless: true });
  ok(g.isEndless() === true, 'newRun 的第二参数开出了无尽局');
  ok(g.data.map?.branchBonus >= 1, '无尽局第 1 章的地图就比正片宽（分叉 +1）', `branchBonus=${g.data.map?.branchBonus}`);

  // 一路「打赢首领」推进：走 12 章
  const seen = [];
  for (let i = 0; i < 12; i++) {
    g.data.stage = i;
    g.nextStage();
    seen.push({ stage: g.data.stage, phase: g.phase, biome: g.data.map?.biome });
  }
  ok(g.phase !== 'victory', '走了 12 章也没进结局页（无尽模式没有终点）', `phase=${g.phase}`);
  ok(g.data.stage === 12, '章节确实一路涨到第 13 章', `stage=${g.data.stage}`);
  ok(seen.every((s) => s.phase === 'map'), '每一章都正常回到地图');
  ok(new Set(seen.map((s) => s.biome)).size >= 6, '地图一直换（不会困在同一张图上）',
    [...new Set(seen.map((s) => s.biome))].join(' / '));
  ok(g.data.biomes.length >= 13, 'biomes 序列会按需往后补', `${g.data.biomes.length} 张`);
  ok(g.data.map.rows >= 9, '第 13 章的地图不比正片短', `${g.data.map.rows} 行`);

  // 无尽倍率：单调上升 + 正片里也有温和加压
  const muls = [0, 2, 5, 6, 8, 12].map((s) => g.endlessEnemyMul(s));
  ok(muls.every((m, i) => i === 0 || m.hp >= muls[i - 1].hp), '敌人生命倍率随章节单调上升',
    muls.map((m) => m.hp.toFixed(2)).join(' → '));
  ok(muls[0].hp === 1, '第 1 章是 1.00（无尽模式也从第 1 章开始，不会一上来就地狱）');
  ok(muls[1].hp > 1, '正片那几章也略微加压（这样它从第 1 章起就是另一个模式）', `第 3 章 ×${muls[1].hp.toFixed(2)}`);
  ok(muls[5].hp > 2, '过了正片之后复利变强（第 13 章 ×' + muls[5].hp.toFixed(2) + '）');
  ok(endlessRowBonus(11) > endlessRowBonus(5), '越往后地图越长（每 2 章多一行）',
    `第 6 章 +${endlessRowBonus(5)} 行 → 第 12 章 +${endlessRowBonus(11)} 行`);

  // 真的拿 scaleEnemy 算一只，确认倍率落到了数值上
  const mob = ENEMIES.find((e) => e.tier === 'mob');
  const stats = { atk: 40, def: 20, maxHp: 300, agi: 15 };
  const normal = scaleEnemy(mob, 8, 3, stats, null);
  const endless = scaleEnemy(mob, 8, 3, stats, g.endlessEnemyMul(8));
  ok(endless.hp > normal.hp && endless.atk > normal.atk, '同一章同一只怪：无尽模式确实更强',
    `HP ${normal.hp} → ${endless.hp} · 攻击 ${normal.atk} → ${endless.atk}`);
}

// ---------- ③ 解锁与成绩 ----------
group('③ 解锁条件与成绩记录');
{
  const g = new Game({ seed: 7 });
  g.newRun(7);
  const before = JSON.parse(localStorage.getItem('oasis_desert_spirit_meta_v1') ?? '{}');
  ok(before.endlessUnlocked !== true, '新档没解锁无尽模式', String(before.endlessUnlocked));

  // 模拟走完正片：把 stage 推到最后一章再 nextStage
  g.data.stage = stageCount() - 1;
  g.nextStage();
  ok(g.phase === 'victory', '正片走到头是结局页（普通模式没被无尽改坏）', `phase=${g.phase}`);
  const after = JSON.parse(localStorage.getItem('oasis_desert_spirit_meta_v1') ?? '{}');
  ok(after.endlessUnlocked === true, '通关一次 → **解锁无尽模式**（用户指定的条件）');
  ok(after.wins >= 1, '胜场 +1', `wins=${after.wins}`);

  // 无尽局走一段之后记下最远章节（造一个「输了」的战斗结算：finishBattle 只看这几个字段）
  const g2 = new Game({ seed: 8 });
  g2.newRun(8, { endless: true });
  g2.data.stage = 9;
  g2.data.floor = 4;
  g2.battle = {
    over: true, winner: 'enemy', turn: 5,
    player: { hp: 0 },
    enemy: { id: 'sandshrew', name: '穿山鼠' },
  };
  g2.battleContext = { kind: 'mob', scaled: { rewardMult: 1, tier: 'mob' }, enemyDef: { id: 'sandshrew' } };
  g2.finishBattle();
  const meta2 = JSON.parse(localStorage.getItem('oasis_desert_spirit_meta_v1') ?? '{}');
  ok((meta2.endlessBest ?? 0) >= 10, '无尽局结束时记下「最远到第几章」', `endlessBest=${meta2.endlessBest}`);
  const rec = (meta2.history ?? [])[0];
  ok(rec?.endless === true, '通关记录里那条带上了无尽标记（记录页要区分两种模式）', `endless=${rec?.endless}`);
}

console.log(`\n无尽模式 / 地图分叉回归测试：通过 ${pass}，失败 ${fail}`);
if (fail) process.exitCode = 1;
