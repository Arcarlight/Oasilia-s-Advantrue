// 战斗奖励的回归测试：**打完这一档到底给不给卡、给几张、稀有度是不是更好**。
//
// 为什么要单独立一条测试：用户报过两次「奖励不对劲」——
//   ① 「boss 和精英打完给的卡并没有比普通小怪好」（史诗占比一条直线，见 measure-reward.mjs）
//   ② 「怎么会出现打完 boss 或者精英怪不掉卡的情况？」（精英只有 70% 掉卡，每 10 次空 3 次）
// 两件事都不是崩溃，光靠冒烟测试和肉眼看是抓不住的，所以按「档位 × 概率」钉死在这里。
//
//   node tools/test-reward.mjs
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
const { Game } = await import('../src/core/game.js');
const { BALANCE, REWARD_WEIGHTS } = await import('../src/data/balance.js');

const fails = [];
const ok = (cond, label, detail = '') => {
  const line = `  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  if (!cond) fails.push(label);
};

/** AI 自动打完一场（只看胜负，不关心打得好不好看） */
function autoPlay(b) {
  let guard = 0;
  while (!b.over && guard++ < 200) {
    if (b.active === 'player') {
      const hand = b.hand('player');
      const best = hand.map((c) => ({ c, s: b.scoreCard('player', c.card) })).sort((a, x) => x.s - a.s)[0];
      if (!best || best.s <= 0) break;
      if (!b.playCard(best.c.uid).ok) break;
      b.takeEvents();
    }
    b.endTurn();
    b.takeEvents();
  }
}

/** 打 n 场某一档，返回每场的奖励（拿不到奖励的场次会被抛掉） */
function collect(kind, n, { atk, def, maxHp, agi }) {
  const out = [];
  for (let i = 0; i < n * 4 && out.length < n; i += 1) {
    const g = new Game({ seed: 4000 + i * 23 + kind.length * 7 });
    g.newRun();
    Object.assign(g.data, { atk, def, maxHp, hp: maxHp, agi, luck: 8, stage: 2 });
    g.data.map = { ...g.data.map, biome: 'forest' };
    const b = g.startBattle(kind, 0, 'direct');
    autoPlay(b);
    if (b.winner !== 'player') continue;
    const r = g.finishBattle();
    if (r) out.push(r);
  }
  return out;
}

// 玩家画像：精英 / 首领要用打得赢的数值，否则测不到奖励那头
const PROFILE = { normal: { atk: 60, def: 30, maxHp: 400, agi: 14 }, elite: { atk: 110, def: 60, maxHp: 700, agi: 18 }, boss: { atk: 130, def: 70, maxHp: 800, agi: 20 } };
const N = 120;

console.log('战斗奖励回归测试：');
const normal = collect('normal', N, PROFILE.normal);
const elite = collect('elite', N, PROFILE.elite);
const boss = collect('boss', N, PROFILE.boss);
ok(normal.length >= N * 0.8, '普通怪样本够用', `${normal.length} 场`);
ok(elite.length >= N * 0.8, '精英样本够用', `${elite.length} 场`);
ok(boss.length >= N * 0.8, '首领样本够用', `${boss.length} 场`);

const noCard = (list) => list.filter((r) => !(r.cardChoices ?? []).length).length;
const slotsOf = (list) => [...new Set(list.map((r) => (r.cardChoices ?? []).length))].sort((a, b) => a - b);

// ① 精英 / 首领**必定出卡**（用户报的那条）
ok(noCard(elite) === 0, '精英必定给卡（不管掷骰子）', `空手 ${noCard(elite)} / ${elite.length}`);
ok(noCard(boss) === 0, '首领必定给卡', `空手 ${noCard(boss)} / ${boss.length}`);
// ② 普通怪按 cardRewardChance 抽（不是「必定」，也不是「总不给」）
const normalNoCard = noCard(normal) / normal.length;
ok(Math.abs(normalNoCard - (1 - BALANCE.cardRewardChance)) < 0.15,
  `普通怪空手率≈ ${(100 - BALANCE.cardRewardChance * 100).toFixed(0)}%`, `实测 ${(normalNoCard * 100).toFixed(1)}%`);

// ③ 选项张数：精英 / 首领 4 张，普通怪 3 张
ok(slotsOf(elite).every((n) => n === 4), '精英给 4 个选项', `实际 ${slotsOf(elite).join('/')}`);
ok(slotsOf(boss).every((n) => n === 4), '首领给 4 个选项', `实际 ${slotsOf(boss).join('/')}`);
ok(slotsOf(normal.filter((r) => (r.cardChoices ?? []).length)).every((n) => n === 3), '普通怪给 3 个选项',
  `实际 ${slotsOf(normal.filter((r) => (r.cardChoices ?? []).length)).join('/')}`);

// ④ 稀有度随档位变好（史诗占比单调上升）
const EPIC = ['epic', 'rare', 'uncommon', 'common'];
const epicRate = (list) => {
  const cards = list.flatMap((r) => r.cardChoices ?? []);
  return cards.filter((c) => c.rarity === 'epic').length / Math.max(1, cards.length);
};
const eN = epicRate(normal); const eE = epicRate(elite); const eB = epicRate(boss);
ok(eE > eN * 1.3, '精英的史诗占比明显高于普通怪', `${(eN * 100).toFixed(1)}% → ${(eE * 100).toFixed(1)}%`);
ok(eB > eE * 1.3, '首领的史诗占比明显高于精英', `${(eE * 100).toFixed(1)}% → ${(eB * 100).toFixed(1)}%`);
ok(!!REWARD_WEIGHTS.boss && !!REWARD_WEIGHTS.elite, '档位权重表在（content/rarity.json 的 rewardWeights）');

// ⑤ 奖励里不会混进敌人专用卡
const enemyOnly = [...normal, ...elite, ...boss].flatMap((r) => r.cardChoices ?? []).filter((c) => c.enemyOnly);
ok(enemyOnly.length === 0, '奖励卡里没有敌人专用卡', enemyOnly.map((c) => c.id).join('、') || '干净');

if (fails.length) {
  console.error(`\n战斗奖励回归测试：通过 ${13 - fails.length}，失败 ${fails.length}`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('\n战斗奖励回归测试：通过 13，失败 0');
