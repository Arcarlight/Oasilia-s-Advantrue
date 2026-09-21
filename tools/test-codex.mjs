// 通关记录 / 图鉴的回归测试。
//
// 为什么要单独一条：这三块界面**不崩溃**，坏了只会「记不上 / 显示错」——
// 冒烟测试和肉眼都抓不住，而这正是用户最容易一眼看出来的那类问题：
//   · 打完一局回到标题，记录里没有这一局；
//   · 记录里的卡组在切成日语之后变成一串 id 或者旧语言的名字；
//   · 敌人图鉴少了几只（分节时按 biome 过滤，某个 biome 键写错就会被静默丢掉）。
// 所以这里钉住的是：**写进去了没有、写的是不是 id、有没有被漏掉**。
//
//   node tools/test-codex.mjs
let writes = 0;
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { writes += 1; this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const { save, HISTORY_MAX } = await import('../src/core/save.js');
const { Game } = await import('../src/core/game.js');
const { CARDS, CARD_BY_ID } = await import('../src/data/cards.js');
const { ENEMIES, ENEMY_BY_ID, TIERS } = await import('../src/data/enemies.js');
const { BIOMES } = await import('../src/data/balance.js');
const { stageCount } = await import('../src/data/mapgen.js');
const { cardCodexProgress, enemyCodexProgress, enemyCodexSets, codexStateOf } = await import('../src/ui/codex.js');
const { recordsSummary } = await import('../src/ui/records.js');

const fails = [];
const ok = (cond, label, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails.push(label);
};

const META_KEY = 'oasis_desert_spirit_meta_v1';

/** 自动打完一场（不关心打得好不好看，只关心结束） */
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

console.log('通关记录 / 图鉴回归测试：');

// ---------- ① 老存档：没有这些新字段也不能炸 ----------
{
  // 这个功能之前的老记录（那时候只有 seenCards）
  localStorage._m.set(META_KEY, JSON.stringify({ runs: 3, wins: 1, kills: 40, bestDistance: 7, seenCards: ['tackle'] }));
  const meta = save.readMeta();
  ok(Array.isArray(meta.history) && Array.isArray(meta.seenEnemies) && Array.isArray(meta.slainEnemies),
    '老存档会补出新字段（history / seenEnemies / slainEnemies）',
    `history=${Array.isArray(meta.history)} seen=${Array.isArray(meta.seenEnemies)} slain=${Array.isArray(meta.slainEnemies)}`);
  ok(meta.seenCards.length === 1 && meta.runs === 3, '老存档里原有的字段没被动过');

  localStorage._m.set(META_KEY, '{ 这不是 JSON');
  const broken = save.readMeta();
  ok(Array.isArray(broken.history) && broken.history.length === 0, '记录文件坏掉时不抛异常，退回空记录');
  localStorage._m.delete(META_KEY);
}

// ---------- ② 图鉴的写入：见过 / 击败 / 幂等 / 只在新增时写盘 ----------
{
  localStorage._m.delete(META_KEY);
  writes = 0;
  let meta = save.noteEnemies(['gible']);
  ok(meta.seenEnemies.includes('gible') && !meta.slainEnemies.includes('gible'), '「遇见」记进 seen、不算击败');
  const afterFirst = writes;
  save.noteEnemies(['gible']);
  ok(writes === afterFirst, '同一只怪再遇见一次不会重复写盘', `写盘次数 ${writes}`);

  meta = save.noteEnemies(['gible'], { slain: true });
  ok(meta.slainEnemies.includes('gible'), '打赢之后记进 slain');
  ok(meta.seenEnemies.filter((x) => x === 'gible').length === 1, 'seen 里不会出现重复条目');

  save.noteEnemies(['cacnea'], { slain: true });
  meta = save.readMeta();
  ok(meta.seenEnemies.includes('cacnea') && meta.slainEnemies.includes('cacnea'),
    '直接记「击败」时自动也算「遇见」');
  localStorage._m.delete(META_KEY);
}

// ---------- ③ 战绩：最新的在前、有上限 ----------
{
  localStorage._m.delete(META_KEY);
  for (let i = 0; i < HISTORY_MAX + 10; i += 1) save.recordRun({ at: i, win: false, stage: 1, steps: i, deck: [], biomes: [] });
  const history = save.readMeta().history;
  ok(history.length === HISTORY_MAX, `明细只留最近 ${HISTORY_MAX} 局`, `实际 ${history.length}`);
  ok(history[0].steps === HISTORY_MAX + 9, '最新的排在最前面', `history[0].steps=${history[0].steps}`);
  save.clearHistory();
  ok(save.readMeta().history.length === 0, '清空记录只清战绩');
  localStorage._m.delete(META_KEY);
}

// ---------- ④ 真打一局（失败路线）写进记录 ----------
{
  localStorage._m.delete(META_KEY);
  const g = new Game({ seed: 20260214 });
  g.newRun(20260214);
  const before = new Set(save.readMeta().seenEnemies);
  const b = g.startBattle('normal', 0, 'direct');
  ok(save.readMeta().seenEnemies.length === before.size + 1,
    '开打就记进敌人图鉴（不用打赢）', `新增 ${save.readMeta().seenEnemies.length - before.size} 只`);

  // 故意不还手，等它把玩家打回家 —— 走的是真实的失败路径
  let guard = 0;
  while (!b.over && guard++ < 300) { b.endTurn(); b.takeEvents(); }
  ok(b.over && b.winner !== 'player', '这局真的输了（用来测失败路线）', `winner=${b.winner} 回合=${b.turn}`);

  const r = g.finishBattle();
  const meta = save.readMeta();
  const rec = meta.history[0];
  ok(!r.win && meta.history.length === 1, '失败也记一条战绩', `history=${meta.history.length}`);
  ok(rec.win === false && rec.stage >= 1, '记录里写着「止步第几章」', `stage=${rec.stage}`);
  ok(rec.foe && !!ENEMY_BY_ID[rec.foe], '记录里存的是**敌人 id**（不是名字）', `foe=${rec.foe}`);
  ok(meta.seenEnemies.includes(rec.foe) && !meta.slainEnemies.includes(rec.foe),
    '被它打回家 = 见过但没击败');
  ok(rec.deck.length === g.data.deck.length && rec.deck.every((id) => !!CARD_BY_ID[id]),
    '卡组存的是卡牌 id（每个都能在卡表里查到）', `${rec.deck.length} 张`);
  ok(rec.biomes.length === stageCount() && rec.biomes.every((k) => !!BIOMES[k]),
    `记录里存了这局的 ${stageCount()} 张地图 key`, rec.biomes.join(' → '));
  ok(rec.steps >= 1, '记了步数', `${rec.steps} 步`);
  localStorage._m.delete(META_KEY);
}

// ---------- ⑤ 通关路线（含章节数夹回） ----------
{
  localStorage._m.delete(META_KEY);
  const g = new Game({ seed: 7 });
  g.newRun(7);
  g.data.stage = stageCount() - 1;
  g.startBattle('boss', 0, 'direct');
  autoPlay(g.battle);
  if (g.battle.winner === 'player') {
    g.finishBattle();
    if (g.phase === 'reward') g.takeRewardCard(null);
  }
  // 直接推进最后一章：这一条只测「通关怎么写记录」，不必真打赢结局首领
  g.data.stage = stageCount() - 1;
  g.nextStage();
  const meta = save.readMeta();
  const rec = meta.history[0];
  ok(g.phase === 'victory', '推完最后一章进结算页');
  ok(rec?.win === true, '通关也记一条战绩（win = true）');
  ok(rec.stage === stageCount(), `通关记录的章节数夹在 ${stageCount()}（不会记成 ${stageCount() + 1}）`, `stage=${rec.stage}`);
  ok(meta.bestStage === stageCount(), '最远章节会跟着更新', `bestStage=${meta.bestStage}`);
  ok(meta.history.every((x) => typeof x.at === 'number' && Array.isArray(x.deck)),
    '每条记录都带时间戳和卡组 id 列表');

  const s = recordsSummary(meta);
  ok(s.wins >= 1 && s.runs >= 1, '汇总数字能算出来', `总场次 ${s.runs} / 通关 ${s.wins}`);
  localStorage._m.delete(META_KEY);
}

// ---------- ⑥ 汇总数字 ----------
{
  const meta = {
    runs: 5, wins: 2, kills: 33, bestStage: 4,
    history: [
      { win: true, stage: 6, steps: 42, deck: [] },
      { win: true, stage: 6, steps: 31, deck: [] },
      { win: false, stage: 4, steps: 20, deck: [] },
    ],
  };
  const s = recordsSummary(meta);
  ok(s.runs === 7, '总场次 = 失败局数 + 通关次数（老计数器继续算数）', `${s.runs}`);
  ok(s.fastest === 31, '最快通关取通关局里步数最少的', `${s.fastest} 步`);
  ok(s.bestStage === 6, '最远章节取记录与计数器里更大的那个', `${s.bestStage}`);
  ok(s.listed === 3, '明细条数单独报出来', `${s.listed}`);
}

// ---------- ⑦ 进度数字与筛选口径 ----------
{
  localStorage._m.set(META_KEY, JSON.stringify({
    seenCards: ['tackle', 'bite'], seenEnemies: ['gible', 'cacnea'], slainEnemies: ['gible'],
  }));
  // 从真卡表里挑一张没拿过的（别手写 id：卡 id 改过名的话这条断言会假通过）
  const fresh = CARDS.find((c) => !['tackle', 'bite'].includes(c.id)).id;
  const p = cardCodexProgress(['tackle', fresh]);
  ok(p.got === 3, '卡牌进度 = 「这一局带着的」∪「以前拿过的」', `${p.got}（tackle 重复只算一次）`);
  ok(p.total === CARDS.length, '卡牌进度分母是全部卡牌', `${p.total}`);
  // 旧存档里可能有已经不存在的卡牌 id：不能把它算进收集进度
  ok(cardCodexProgress(['__不存在的卡__']).got === 2, '卡表里查不到的 id 不参与计数', `got=${cardCodexProgress(['__不存在的卡__']).got}`);

  const sets = enemyCodexSets();
  const ep = enemyCodexProgress(sets);
  ok(ep.total === ENEMIES.length, '敌人进度分母是全部敌人', `${ep.total}`);
  ok(ep.seen === 2 && ep.beaten === 1, '见过 2 只、其中击败 1 只', `seen=${ep.seen} beaten=${ep.beaten}`);
  ok(enemyCodexSets().seen.has('gible'), '「击败过」的也一定算「收录」');

  // 状态判据：这一局带着 > 以前拿过 > 没见过
  ok(codexStateOf('tackle', new Set(['tackle']), new Set()) === 'deck', '这一局带着的卡是 deck 状态');
  ok(codexStateOf('bite', new Set(), new Set(['bite'])) === 'seen', '以前拿过的是 seen 状态');
  ok(codexStateOf('ember', new Set(), new Set()) === 'new', '没见过的是 new 状态');
  localStorage._m.delete(META_KEY);
}

// ---------- ⑧ 敌人图鉴不会漏掉任何一只 ----------
{
  // 图鉴是按 biome 分节的（showEnemyCodex 里 filter(e => e.biome === key)）——
  // 万一某只怪的 biome 拼错、或者档位不在 TIER_ORDER 里，它就会被**静默丢掉**，
  // 而界面上只是「少了一格」，谁都看不出来。这里把「分完之后总数还是 156」钉死。
  const TIER_ORDER = ['mob', 'normal', 'elite', 'boss'];
  let grouped = 0;
  const missingBiome = [];
  for (const key of Object.keys(BIOMES)) {
    grouped += ENEMIES.filter((e) => e.biome === key).length;
  }
  for (const e of ENEMIES) if (!BIOMES[e.biome]) missingBiome.push(`${e.id}(${e.biome})`);
  ok(grouped === ENEMIES.length, '按地图分节之后一只都没漏', `${grouped} / ${ENEMIES.length}`);
  ok(!missingBiome.length, '每只敌人的 biome 都是已知地图', missingBiome.join('、') || '全部对得上');
  ok(ENEMIES.every((e) => TIER_ORDER.includes(e.tier)), '每只敌人的档位都在图鉴的排序表里');
  ok(ENEMIES.every((e) => e.dex && e.slug), '每只敌人都有图鉴编号与立绘 slug');
  ok(Object.keys(TIERS).every((t) => TIER_ORDER.includes(t)) && Object.keys(TIERS).length === TIER_ORDER.length,
    '档位表和图鉴的排序表是同一套', Object.keys(TIERS).join('/'));
  const ids = new Set(ENEMIES.map((e) => e.id));
  ok(ids.size === ENEMIES.length, '敌人 id 不重复（否则图鉴会出现两格同样的记录）');
}

/**
 * 「仅敌人可用」的卡（enemyOnly）：玩家永远抽不到，所以**解锁条件是看见敌方打出**（用户定的规则）。
 * 这里钉住三件事：① 它们不进玩家抽奖池；② 敌方打出之后会被记进「见过」；③ 图鉴里能看到它们。
 */
{
  const bench = CARDS.filter((c) => c.enemyOnly);
  ok(bench.length > 0, `有一批只给敌人用的牌（${bench.length} 张）`);
  const { rollCard } = await import('../src/data/cards.js');
  let leaked = 0;
  for (let i = 0; i < 400; i++) if (rollCard(0, []).enemyOnly) leaked += 1;
  ok(leaked === 0, '抽奖池里绝不会抽到「仅敌人可用」的牌', `400 次里 ${leaked} 次`);

  // 开一场战斗，让敌人真的打出几张牌，看图鉴有没有记下来
  const g = new Game({ seed: 31337 });
  g.newRun(31337);
  const before = new Set(save.readMeta().seenCards ?? []);
  const benchIds = new Set(bench.map((c) => c.id));
  g.startBattle('normal', 0, 'direct');
  const playedBench = [];
  for (let turn = 0; turn < 12 && !g.battle.over; turn++) {
    if (g.battle.active !== 'enemy') g.battle.endTurn();
    if (g.battle.over) break;
    g.battle.enemyAct();
    for (const ev of g.battle.takeEvents()) {
      if (ev.type === 'playCard' && ev.side === 'enemy' && benchIds.has(ev.id)) playedBench.push(ev.id);
    }
  }
  const after = new Set(save.readMeta().seenCards ?? []);
  const learned = [...after].filter((id) => !before.has(id) && benchIds.has(id));
  ok(learned.length > 0,
    '敌方打出的「仅敌人可用」牌会被记进图鉴（看见就解锁，不用拿到手）',
    `本局敌方打出 ${playedBench.length} 张这类牌，图鉴新记住 ${learned.length} 张：${learned.slice(0, 4).map((id) => CARD_BY_ID[id]?.name).join('/')}`);

  // 图鉴的「已见」判定：记过之后就不再是「未获得」
  ok(codexStateOf(learned[0], new Set(), after) === 'seen',
    '记过之后图鉴里是「曾拿过」（不再压暗）', CARD_BY_ID[learned[0]]?.name);
}

if (fails.length) {
  console.error(`\n通关记录 / 图鉴回归测试：失败 ${fails.length} 条`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('\n通关记录 / 图鉴回归测试：全部通过');
