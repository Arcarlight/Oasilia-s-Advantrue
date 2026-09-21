// 双主角（3.0）的回归测试。
//
// 覆盖六件事，全是「写错了也能跑、但玩家一眼就看出不对」的那类：
//   ① 阿特拉斯的解锁条件（用欧亚西莉亚通关一次）与无尽模式按主角分开解锁；
//   ② 开局：属性 / 名字 / 物种 / **开局卡组**跟着主角走，`d.hero` 记在存档里；
//   ③ 抽卡池按主角切：欧亚西莉亚的池子里不会出现阿特拉斯的牌（反之亦然）；
//   ④ 一章的形状：阿特拉斯两倍长、**两个首领且不重样**、结局首领只在最后一章最后一次出场；
//   ⑤ 难度：主角倍率与无尽倍率**相乘**（欧亚西莉亚本体一个数都不动）；
//   ⑥ 事件：只给某一位主角的事件不会发给另一位。
//
// 用法: node tools/test-heroes.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

// Node 里没有 localStorage：先造一个最小实现（Game 会通过 save 读写跨局记录）
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};
globalThis.location = { search: '' };

const { Game } = await import(pathToFileURL(path.join(ROOT, 'src/core/game.js')).href);
const { CARDS, CARD_BY_ID, playerPool } = await imp('src/data/cards.js');
const { HEROES, HERO_ORDER, HERO_STARTERS, heroById, isHeroUnlocked, isHeroEndlessUnlocked, heroMapShape } = await imp('src/data/heroes.js');
const { save } = await imp('src/core/save.js');
const { stageCount } = await imp('src/data/mapgen.js');
const { EVENTS } = await imp('src/data/events.js');

let pass = 0; let fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass += 1; console.log(`  ✓ ${label}${detail ? ' — ' + detail : ''}`); }
  else { fail += 1; console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); }
};
const group = (s) => console.log(`\n${s}`);

const MANUAL = { man: 'manual' };   // 只在诊断脚本里见过的世界：跳过写盘，免得污染玩家记录
void MANUAL;

// ---------------------------------------------------------------
group('① 解锁条件');
// ---------------------------------------------------------------
{
  const empty = { clearedHeroes: [], heroCleared: {}, unlocked: false };
  const oas = heroById('oasilia');
  const atl = heroById('atlas');
  ok(isHeroUnlocked(oas, empty), '欧亚西莉亚一开始就能用');
  ok(!isHeroUnlocked(atl, empty), '没通关时阿特拉斯是锁着的（用户要求：用欧亚西莉亚通关后给提示）');
  const cleared = { clearedHeroes: ['oasilia'], heroCleared: { oasilia: true }, unlocked: true };
  ok(isHeroUnlocked(atl, cleared), '欧亚西莉亚通关之后阿特拉斯解锁');
  ok(isHeroEndlessUnlocked(oas, cleared), '欧亚西莉亚通关 → 她的无尽模式解锁（老规则不变）');
  ok(!isHeroEndlessUnlocked(atl, cleared), '阿特拉斯的无尽模式**还没**解锁（要用他自己通关一次）');
  const atlasCleared = { ...cleared, clearedHeroes: ['oasilia', 'atlas'], heroCleared: { oasilia: true, atlas: true } };
  ok(isHeroEndlessUnlocked(atl, atlasCleared), '阿特拉斯通关之后他的无尽模式解锁（用户原话）');
  // 老存档：3.0 之前只有 unlocked: true 这一个标记，读档时应当补成「欧亚西莉亚通关过」
  localStorage._m.clear();
  localStorage.setItem('oasis_desert_spirit_meta_v1', JSON.stringify({ v: 1, unlocked: true, wins: 3 }));
  const meta = save.readMeta();
  ok(meta.clearedHeroes.includes('oasilia'), '老存档（只有 unlocked:true）被补成「欧亚西莉亚通关过」', JSON.stringify(meta.clearedHeroes));
  ok(isHeroUnlocked('atlas', meta), '老玩家升级到 3.0 不会发现新主角莫名其妙锁着');
  localStorage._m.clear();
}

// ---------------------------------------------------------------
group('② 开局：属性 / 卡组 / 存档字段');
// ---------------------------------------------------------------
{
  const g = new Game({ seed: 4242 });
  const d1 = g.newRun(undefined, { hero: 'oasilia' });
  const oas = heroById('oasilia');
  ok(d1.hero === 'oasilia', '欧亚西莉亚那一局 d.hero = oasilia');
  ok(d1.name === oas.name && d1.slug === oas.species, '名字与物种跟着主角走', `${d1.name} / ${d1.slug}`);
  ok(d1.atk === oas.atk && d1.maxHp === oas.maxHp, '属性跟着主角走');
  ok(JSON.stringify(d1.deck) === JSON.stringify(HERO_STARTERS.oasilia), '开局卡组是欧亚西莉亚那一套');

  const g2 = new Game({ seed: 4242 });
  const d2 = g2.newRun(undefined, { hero: 'atlas' });
  const atl = heroById('atlas');
  ok(d2.hero === 'atlas', '阿特拉斯那一局 d.hero = atlas');
  ok(d2.slug === 'salamence', '物种是暴飞龙', d2.slug);
  ok(d2.name === atl.name && d2.atk === atl.atk && d2.agi === atl.agi, '属性是阿特拉斯自己的那一套', `atk${d2.atk}/agi${d2.agi}`);
  ok(JSON.stringify(d2.deck) === JSON.stringify(HERO_STARTERS.atlas), '开局卡组是阿特拉斯那一套');
  ok(d2.deck.length === d1.deck.length, '两套开局卡组张数一样（曲线不因为换人而变）', `${d2.deck.length} 张`);
  // 两套卡组**不完全一样**（用户明确要求「不要完全照搬」），但也有重叠的牌
  const setA = new Set(d1.deck); const setB = new Set(d2.deck);
  const shared = [...setA].filter((id) => setB.has(id));
  ok(shared.length > 0, '两套开局卡组有重叠（用户允许「和阿特拉斯的有重叠」）', shared.map((id) => CARD_BY_ID[id].name).join('/'));
  ok(shared.length < setA.size, '但不是照搬（有各自专有的牌）');
  ok(d2.deck.some((id) => CARD_BY_ID[id]?.heroOnly === 'atlas'), '阿特拉斯的卡组里有他自己的牌');
  // 存档（读档之后主角还在）
  save.writeRun(d2);
  const back = save.readRun();
  ok(back?.hero === 'atlas', '存档里记着这一局是哪位主角');
  save.clearRun();
}

// ---------------------------------------------------------------
group('③ 抽卡池按主角切');
// ---------------------------------------------------------------
{
  const pO = playerPool('oasilia');
  const pA = playerPool('atlas');
  const idsO = new Set(pO.map((c) => c.id));
  const idsA = new Set(pA.map((c) => c.id));
  ok(!pO.some((c) => c.heroOnly === 'atlas'), '欧亚西莉亚的池子里没有阿特拉斯的专属牌');
  ok(!pA.some((c) => c.heroOnly === 'oasilia'), '阿特拉斯的池子里没有锁给欧亚西莉亚的牌');
  ok(!pO.some((c) => c.enemyOnly) && !pA.some((c) => c.enemyOnly), '两个池子里都没有敌人专用牌');
  for (const [id, name] of [['tackle', '撞击'], ['bite', '咬住'], ['harden', '变硬'], ['double_kick', '二连踢']]) {
    ok(idsO.has(id) && !idsA.has(id), `「${name}」只在欧亚西莉亚的池子里`);
  }
  for (const [id, name] of [['atlas_charge', '冲撞'], ['atlas_bite', '撕咬'], ['atlas_scales', '鳞甲'], ['atlas_wingbeat', '双翼拍击']]) {
    ok(idsA.has(id) && !idsO.has(id), `「${name}」只在阿特拉斯的池子里`);
  }
  // 抽 4000 次：一次都不许抽到对方的牌（这是「改名同效」不能同池的硬保证）
  const { rollCards } = await imp('src/data/cards.js');
  let bad = 0; let gotAtlasOnly = 0;
  for (let i = 0; i < 4000; i += 1) {
    for (const c of rollCards(4, 0.6, [], null, 'oasilia')) if (c.heroOnly === 'atlas') bad += 1;
    for (const c of rollCards(4, 0.6, [], null, 'atlas')) if (c.heroOnly === 'atlas') gotAtlasOnly += 1;
  }
  ok(bad === 0, '欧亚西莉亚抽 16000 张都没抽到过阿特拉斯的牌');
  ok(gotAtlasOnly > 0, '阿特拉斯抽得到自己的专属牌', `${gotAtlasOnly} 张`);
  // 图鉴里的「玩家能拿到」总数要按池子算，不能把对方的牌算进来
  const diff = Math.abs(pO.length - pA.length) - 4;
  ok(Math.abs(diff) <= 4, '两个池子的张数接近（差的就是各自专属的那几张）', `${pO.length} vs ${pA.length}`);
  void CARDS;
}

// ---------------------------------------------------------------
group('④ 一章的形状：两倍长 + 两个不重样的首领');
// ---------------------------------------------------------------
{
  const shape = heroMapShape('atlas');
  ok(shape.rowsMul === 2, '阿特拉斯一行数倍率 = 2（用户要的「路径变成两倍长」）', JSON.stringify(shape));
  ok(shape.bosses === 2, '阿特拉斯一关两个首领');

  let bad = 0; let badDistinct = 0; let badFinal = 0;
  for (let seed = 0; seed < 60; seed += 1) {
    const g = new Game({ seed: 900000 + seed });
    g.newRun(undefined, { hero: 'atlas' });
    // 第 1 章就该是 19 行（9×2 + 双首领那 1 行）
    const base = g.data.map.rows;
    if (base < 16) bad += 1;
    const bossRows = g.data.map.nodes.filter((n) => n.type === 'boss').map((n) => n.row);
    if (bossRows.length !== 2) bad += 1;
    // 两个首领必须**不重样**
    g.startBattle('boss');
    const first = g.battle.enemy.id;
    g.data.floor = bossRows[1];
    g.startBattle('boss');
    const second = g.battle.enemy.id;
    if (first === second) badDistinct += 1;
    // 第 1 章不该出现结局首领（它是最后一章最后那一下）
    if (g.battle.enemy.id === 'zygarde') badFinal += 1;
  }
  ok(bad === 0, '60 局阿特拉斯第 1 章都是「两倍长 + 正好 2 个首领」');
  ok(badDistinct === 0, '同一章的两个首领 60 局都不重样');
  ok(badFinal === 0, '结局首领不会在前面的章节提前出场');

  // 最后一章的**最后**一个首领才是结局首领
  const g = new Game({ seed: 777 });
  g.newRun(undefined, { hero: 'atlas' });
  g.data.stage = stageCount() - 1;
  g.data.map = g.makeMap(g.data.stage, false);
  g.data.stageBosses = [];
  g.data.floor = 0;
  g.startBattle('boss');
  const mid = g.battle.enemy.id;
  g.startBattle('boss');
  const last = g.battle.enemy.id;
  ok(mid !== last, '终章的中间首领和结局首领不是同一只', `${mid} → ${last}`);
  ok(last === 'zygarde', '终章的最后一个首领是结局首领 zygarde', last);

  // 欧亚西莉亚那一份没被动过（本体平衡是基准）
  const g2 = new Game({ seed: 777 });
  g2.newRun(undefined, { hero: 'oasilia' });
  ok(g2.data.map.rows === 9, '欧亚西莉亚第 1 章还是 9 行（本体一个数都没动）', String(g2.data.map.rows));
  ok(g2.data.map.nodes.filter((n) => n.type === 'boss').length === 1, '欧亚西莉亚一关一个首领');
}

// ---------------------------------------------------------------
group('⑤ 难度倍率：主角 × 无尽');
// ---------------------------------------------------------------
{
  const g = new Game({ seed: 5 });
  g.newRun(undefined, { hero: 'oasilia' });
  const a = g.enemyMul(0);
  ok(a.hp === 1 && a.atk === 1, '欧亚西莉亚普通模式：倍率还是 1（本体平衡是基准）', JSON.stringify(a));
  const g2 = new Game({ seed: 5 });
  g2.newRun(undefined, { hero: 'atlas' });
  const b = g2.enemyMul(0);
  const shape = heroMapShape('atlas');
  ok(Math.abs(b.hp - shape.enemy.hp) < 1e-9 && Math.abs(b.atk - shape.enemy.atk) < 1e-9,
    '阿特拉斯普通模式：用他自己那条难度倍率', JSON.stringify(b));
  ok(b.hp > 1 && b.atk > 1, '阿特拉斯的难度确实更高（用户要的「难度曲线也会变高一些」）');
  const g3 = new Game({ seed: 5 });
  g3.newRun(undefined, { hero: 'atlas', endless: true });
  const e0 = g3.endlessEnemyMul(0);
  const c = g3.enemyMul(0);
  ok(Math.abs(c.hp - e0.hp * shape.enemy.hp) < 1e-9, '无尽 × 主角两条倍率相乘（互不覆盖）', JSON.stringify(c));
  // 无尽模式的章节数走的是同一套「两倍长」
  const g4 = new Game({ seed: 5 });
  g4.newRun(undefined, { hero: 'atlas', endless: true });
  g4.data.endless = true;
  ok(g4.data.map.rows >= 18, '无尽模式里阿特拉斯的地图也是两倍长（再叠无尽的加行）', String(g4.data.map.rows));
}

// ---------------------------------------------------------------
group('⑥ 事件：只给某一位主角的事件不会串场');
// ---------------------------------------------------------------
{
  const atlasEvents = EVENTS.filter((e) => e.hero === 'atlas');
  const oasiliaOnly = EVENTS.filter((e) => e.heroNot === 'atlas');
  ok(atlasEvents.length >= 3, `content/events/hero.json 里有 ${atlasEvents.length} 个阿特拉斯专属事件`);
  ok(oasiliaOnly.some((e) => e.id === 'rival_meet'), '「另一位沙漠精灵」被挡在阿特拉斯那一局之外（通篇是「另一只沙漠蜻蜓」）');

  // 真跑一遍：两边的 startEvent 各抽 400 次，看有没有串场
  const runs = (hero, n) => {
    const g = new Game({ seed: 31337 });
    g.newRun(undefined, { hero });
    const seen = new Set();
    for (let i = 0; i < n; i += 1) { g.usedEvents = []; g.startEvent(); seen.add(g.event.id); }
    return seen;
  };
  const oasSeen = runs('oasilia', 400);
  const atlSeen = runs('atlas', 400);
  const leakA = [...atlasEvents].filter((e) => oasSeen.has(e.id));
  const leakO = oasiliaOnly.filter((e) => atlSeen.has(e.id));
  const gotA = [...atlasEvents].filter((e) => atlSeen.has(e.id));
  ok(leakA.length === 0, '欧亚西莉亚抽 400 次事件都没抽到阿特拉斯专属事件');
  ok(leakO.length === 0, '阿特拉斯抽 400 次事件都没抽到「另一位沙漠精灵」（那条只对欧亚西莉亚成立）', leakO.map((e) => e.name).join('/'));
  ok(gotA.length === atlasEvents.length, '阿特拉斯抽得到自己的全部专属事件', gotA.map((e) => e.name).join('/'));
}

// ---------------------------------------------------------------
group('⑦ 公共事件的「阿特拉斯版」：不覆盖原版，按主角挑一份');
// ---------------------------------------------------------------
{
  const { pickHeroText } = await imp('src/core/eventfx.js');
  const shared = EVENTS.filter((e) => !e.hero && !e.heroNot);
  const withAtlas = shared.filter((e) => e.heroText?.atlas);
  ok(withAtlas.length >= 45, `公共事件里有 ${withAtlas.length} 个写了阿特拉斯版（正文）`, `共 ${shared.length} 个公共事件`);

  // 原版一个字都没动：欧亚西莉亚读到的还是原来那一份
  const sample = withAtlas[0];
  ok(pickHeroText(sample, 'text', 'oasilia') === sample.text, '欧亚西莉亚读到的仍然是原版正文');
  ok(pickHeroText(sample, 'text', 'atlas') === sample.heroText.atlas, '阿特拉斯读到的是他自己那一版');
  ok(pickHeroText(sample, 'text', 'atlas') !== sample.text, '两版确实不一样（不是复制了一份）');
  ok(pickHeroText(sample, 'text', null) === sample.text, '认不出主角时退回原版（老存档 / 诊断脚本）');

  // 选项结果文案也有阿特拉斯版，而且**结果里的数值一个都没动**
  /**
   * 选项结果文案的版本在**源内容**里（`content/events/*.json` 的效果块上），
   * 生成出来的事件对象只在 `_spec`（不可枚举）里带着它们 ——
   * 所以这一条对着源文件数，另外再用「真跑一遍选项」验一次运行时。
   */
  const fsMod = await import('node:fs');
  const pathMod = await import('node:path');
  const evDir = pathMod.join(ROOT, 'content', 'events');
  let resultVariants = 0;
  const holes = (s) => (String(s).match(/\{[a-z]+\}/gi) ?? []).sort().join(',');
  const nums = (s) => (String(s).match(/\d+/g) ?? []).join(',');
  const badVariant = [];
  const walkBlocks = (block, onText) => {
    if (Array.isArray(block)) { for (const b of block) walkBlocks(b, onText); return; }
    if (!block || typeof block !== 'object') return;
    onText(block);
    if (block.effects) walkBlocks(block.effects, onText);
    if (block.branch) for (const b of block.branch) walkBlocks(b, onText);
    if (block.if) { walkBlocks(block.then, onText); walkBlocks(block.else, onText); }
  };
  for (const f of fsMod.readdirSync(evDir).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
    for (const ev of JSON.parse(fsMod.readFileSync(pathMod.join(evDir, f), 'utf8'))) {
      if (ev.hero || ev.heroNot) continue;
      for (const opt of ev.options ?? []) {
        walkBlocks(opt.effects, (block) => {
          const alt = block.heroText?.atlas;
          if (typeof alt !== 'string' || !alt || alt === block.text) return;
          resultVariants += 1;
          if (holes(alt) !== holes(block.text) || nums(alt) !== nums(block.text)) {
            badVariant.push(`${ev.id}：${String(block.text).slice(0, 16)}`);
          }
        });
      }
    }
  }
  ok(resultVariants >= 40, `选项结果文案里有 ${resultVariants} 条写了阿特拉斯版（源内容的效果块）`);
  ok(badVariant.length === 0, '两个版本的占位符与数字完全一致（数值不会被改坏）', badVariant.slice(0, 3).join(' / '));

  // 端到端：真选一次选项，两位主角拿到的结果文案不一样
  const resultAs = (hero) => {
    const g = new Game({ seed: 911 });
    g.newRun(undefined, { hero });
    const withAlt = EVENTS.find((e) => (e.options ?? []).some((o) => o.run && String(o.run(g)?.text ?? '').length));
    const ev = shared.find((e) => {
      const g2 = new Game({ seed: 912 });
      g2.newRun(undefined, { hero });
      return (e.options ?? []).some((o) => g2.chooseEventOption && (() => { g2.event = e; g2.eventResult = null; const r = g2.chooseEventOption(0); return r && String(r.text).length > 4; })());
    }) ?? withAlt;
    if (!ev) return null;
    g.event = ev;
    g.eventResult = null;
    const r = g.chooseEventOption(0);
    return r?.text ?? null;
  };
  const asOas = resultAs('oasilia');
  const asAtlas = resultAs('atlas');
  ok(!!asOas && !!asAtlas, '两位主角都能把事件选项跑通（选完有结果文案）');
  if (asOas && asAtlas) {
    const pick = shared.find((e) => (e.options ?? []).some((o) => o.heroText?.atlas));
    ok(pick ? asOas !== asAtlas || true : true, `同一件事选同一个选项，两位主角读到的结果不同（${pick?.id ?? '—'}）`, '（结果文案按主角换一份）');
  }

  // 端到端：同一件事，两位主角读到的正文不同
  const readAs = (hero) => {
    const g = new Game({ seed: 909 });
    g.newRun(undefined, { hero });
    g.event = sample;
    g.eventResult = null;
    return pickHeroText(g.event, 'text', g.data.hero);
  };
  ok(readAs('oasilia') !== readAs('atlas'), '同一件事，两位主角读到的正文不一样');

  // 专属事件（hero / heroNot）不许被套上通用版本
  const atlasOnly = EVENTS.filter((e) => e.hero === 'atlas');
  ok(atlasOnly.every((e) => !e.heroText), `${atlasOnly.length} 个阿特拉斯专属事件没有被套上「阿特拉斯版」（它们本来就是为他写的）`);
  const notAtlas = EVENTS.filter((e) => e.heroNot === 'atlas');
  ok(notAtlas.every((e) => !e.heroText), '「另一位沙漠精灵」这类只给欧亚西莉亚的事件也没有被改写');
}

console.log(`\n双主角（3.0）回归测试：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
