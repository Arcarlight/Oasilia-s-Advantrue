// 内容体检：把「内容」和「真实素材 / 运行时模块」对一遍，揪出漏掉的精灵图、头像、图标、章节表。
//
// 和 tools/build-content.mjs 的分工：
//   build-content.mjs  校验 content/*.json 内部结构（id 引用、格式），并生成 src/data/*.js
//   check-content.mjs  校验「生成出来的东西能不能真的跑」：素材在不在、表长度对不对、每章是否齐全
//
// 用法: node tools/check-content.mjs [--strict]
//   --strict 时把「警告」也当失败（准备发布/打包前用）
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const STRICT = process.argv.includes('--strict');

const problems = [];
const warns = [];
const notes = [];
const err = (m) => problems.push(m);
const warn = (m) => warns.push(m);
/** 只是提醒一下、不算问题的信息（不参与 --strict 判定） */
const note = (m) => notes.push(m);

const exists = async (p) => !!(await fs.stat(p).catch(() => null));

const { CARDS, CARD_ART, ITEMS, STARTER_DECK } = await import('../src/data/cards.js');
const { ENEMIES, MOVE_POOLS, TIERS } = await import('../src/data/enemies.js');
const { EVENTS } = await import('../src/data/events.js');
const { BIOMES, STAGE_BIOME, BALANCE, RARITY } = await import('../src/data/balance.js');
const { NODE_TYPES } = await import('../src/data/mapgen.js');
const { BGM_FILES } = await import('../src/core/bgm.js').catch(() => ({ BGM_FILES: null }));

const stageCount = STAGE_BIOME.length;

// ---------- 1. 章节表长度 ----------
for (const [name, table] of [['enemyHp', BALANCE.enemyHp], ['enemyAtk', BALANCE.enemyAtk]]) {
  for (const [tier, arr] of Object.entries(table)) {
    if (arr.length !== stageCount) err(`balance.${name}.${tier} 有 ${arr.length} 个数，但现在是 ${stageCount} 章（表长必须等于章节数）`);
  }
}
if (BALANCE.playerPowerRef.length !== stageCount) err(`balance.playerPowerRef 有 ${BALANCE.playerPowerRef.length} 个数，应为 ${stageCount}`);
if (BALANCE.stageClearGold.length !== stageCount) warn(`balance.stageClearGold 有 ${BALANCE.stageClearGold.length} 个数，应为 ${stageCount}（多出来的章节会用兜底值）`);
// 难度应当逐章递增
for (const [tier, arr] of Object.entries(BALANCE.enemyHp)) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] <= arr[i - 1]) err(`balance.enemyHp.${tier} 第 ${i + 1} 章（${arr[i]}）没有比第 ${i} 章（${arr[i - 1]}）更高`);
  }
}

// ---------- 2. 每章的地图 / 敌人 / 事件覆盖 ----------
// 敌人条目必须带齐物种信息（生成器从 species.json 合并进来的），否则战斗界面会直接崩
for (const e of ENEMIES) {
  for (const k of ['name', 'en', 'dex']) {
    if (!e[k]) problems.push(`敌人 ${e.id} 缺 ${k}（species.json 里登记了吗？）`);
  }
  if (!Array.isArray(e.types) || !e.types.length) problems.push(`敌人 ${e.id} 没有属性 types`);
  if (!Array.isArray(e.lines) || !e.lines.length) problems.push(`敌人 ${e.id} 没有台词 lines`);
}
for (const key of STAGE_BIOME) {
  const b = BIOMES[key];
  if (!b) { err(`STAGE_BIOME 里的 ${key} 没有地图定义`); continue; }
  for (const tier of Object.keys(TIERS)) {
    const list = ENEMIES.filter((e) => e.biome === key && e.tier === tier);
    if (!list.length) err(`地图 ${key}（${b.name}）没有 ${tier} 档敌人`);
  }
  const themed = EVENTS.filter((e) => e.biome === key).length;
  if (themed < 3) warn(`地图 ${key}（${b.name}）只有 ${themed} 个专属事件（建议 ≥3）`);
  // CSS 里应该有这个地图的配色类（.scene-bg-<key>）
  const css = await fs.readFile(path.join(ROOT, 'src', 'ui', 'style.css'), 'utf8');
  if (!css.includes(`scene-bg-${key}`)) warn(`style.css 里没有 .scene-bg-${key}（地图背景会用默认配色）`);
}

// ---------- 3. 素材：精灵图 / 头像 / 卡面图标 / 特效图 ----------
const needAnims = ['Idle', 'Attack', 'Hurt'];
const speciesSlugs = new Set(ENEMIES.map((e) => e.slug));
speciesSlugs.add(BALANCE.player.species);
let missingSprites = 0;
for (const slug of speciesSlugs) {
  for (const a of needAnims) {
    if (!(await exists(path.join(ROOT, 'assets', 'pokemon', slug, a + '.png')))) {
      err(`缺少精灵图 assets/pokemon/${slug}/${a}.png`);
      missingSprites++;
    }
  }
  if (!(await exists(path.join(ROOT, 'assets', 'portraits', slug, 'Normal.png')))) {
    err(`缺少头像 assets/portraits/${slug}/Normal.png`);
    missingSprites++;
  }
}
if (missingSprites) {
  warn(`有 ${missingSprites} 个素材缺失，跑 & tools/fetch-content.ps1 下载（脚本会自动跳过已存在的）`);
}

const fxFiles = new Set(await fs.readdir(path.join(ROOT, 'assets', 'img', 'fx')).catch(() => []));
const iconFiles = new Set(await fs.readdir(path.join(ROOT, 'assets', 'img', 'cards')).catch(() => []));
const css = await fs.readFile(path.join(ROOT, 'src', 'ui', 'style.css'), 'utf8');
for (const c of CARDS) {
  const art = CARD_ART[c.id];
  if (!art) { err(`卡牌 ${c.id} 没有美术定义（content/cards.json 的 ico/fx）`); continue; }
  if (!css.includes(`.${art.ico}`)) err(`卡牌 ${c.id} 的图标类 ${art.ico} 在 style.css 里没有定义`);
  if (!fxFiles.has(`${art.fx}.png`)) err(`卡牌 ${c.id} 的特效图 assets/img/fx/${art.fx}.png 不存在`);
}
for (const [id, it] of Object.entries(ITEMS)) {
  if (!iconFiles.has(`${it.art}.png`)) warn(`道具 ${id} 的图 assets/img/cards/${it.art}.png 不存在`);
}
/**
 * 卡面文案 vs 引擎效果：文案里写的「N 层中毒 / 灼伤 / 虚弱」必须等于 effects 里的 stacks。
 *
 * 卡牌详情页（src/ui/cardtext.js 的 effectLines）会把 effects 原样翻成明细，
 * 所以这里一旦对不上，玩家就会在同一块屏幕上看到「文案写 3 层、明细写 1 层」。
 * （真事：剧毒 / 火焰牙 / 热风 三张牌的文案写 3/2/3 层，效果却都只挂 1 层 ——
 *   卡面文案是设计意图，实测按文案补齐。）
 *
 * 注意「对手**每有** 1 层出血，威力 +20%」这类是**加成条件**而不是在上状态，
 * 所以要先把这种句式摘掉再对账，否则会把「暗影爪」判成错的。
 */
{
  const NAME = { poison: '中毒', toxic: '剧毒', burn: '灼伤', weak: '虚弱', bleed: '出血' };
  const mismatched = [];
  for (const c of CARDS) {
    const applied = c.text
      .replace(/每有\s*\d+\s*层/g, '')
      .replace(/每\s*\d+\s*层/g, '');
    const fromText = {};
    for (const m of applied.matchAll(/(\d+)\s*层\s*(中毒|剧毒|灼伤|虚弱|出血|流血)/g)) {
      const key = m[2] === '流血' ? '出血' : m[2];
      fromText[key] = (fromText[key] ?? 0) + Number(m[1]);
    }
    const fromFx = {};
    for (const e of c.effects) {
      if (e.kind !== 'status') continue;
      fromFx[NAME[e.status]] = (fromFx[NAME[e.status]] ?? 0) + (e.stacks ?? 1);
    }
    for (const k of new Set([...Object.keys(fromText), ...Object.keys(fromFx)])) {
      if ((fromText[k] ?? 0) !== (fromFx[k] ?? 0)) {
        mismatched.push(`卡牌 ${c.id}（${c.name}）文案写 ${fromText[k] ?? 0} 层${k}，效果是 ${fromFx[k] ?? 0} 层`);
      }
    }
  }
  for (const m of mismatched) err(m);
}
for (const [type, def] of Object.entries(NODE_TYPES)) {
  if (!css.includes(`.ico-${def.icon}`)) warn(`节点类型 ${type} 的图标类 ico-${def.icon} 没有定义`);
}

// ---------- 3b. 商人：脸图必须真的在磁盘上（商店界面用它当摊主头像）----------
const { MERCHANTS } = await import('../src/data/merchants.js');
const { EMOTION } = await import('../src/core/portraits.js');
let merchantMissing = 0;
for (const m of MERCHANTS) {
  const dir = path.join(ROOT, 'assets', 'portraits', m.slug);
  const file = (EMOTION[m.emotion ?? 'normal'] ?? 'Normal') + '.png';
  if (await exists(path.join(dir, file))) continue;
  // 表情缺了会回退 Normal（不会破图），Normal 也没有才算真问题
  if (await exists(path.join(dir, 'Normal.png'))) {
    warn(`商人 ${m.id} 的表情 ${file} 上游没有画，运行时会回退到 Normal`);
  } else {
    err(`商人 ${m.id}（${m.name}）没有头像 assets/portraits/${m.slug}/Normal.png —— 商店界面会没有脸`);
    merchantMissing++;
  }
}
if (merchantMissing) warn(`跑 & tools/fetch-content.ps1 可以把缺的头像补上`);

// ---------- 3b. 图标注册表 ----------
// content/icons.json 是图标的唯一数据源，.ico-* 全部由 build-content.mjs 生成进 style.css。
// 这里只做「注册表 <-> 生成区块 有没有对齐」这一件事（结构校验在 build-content.mjs 里，报错即终止）。
{
  const registry = await fs.readFile(path.join(ROOT, 'content', 'icons.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (!registry?.icons) err('content/icons.json 读不出来（不是合法 JSON 或缺 icons 数组）');
  else {
    const gen = css.match(/\/\* #region GENERATED-ICONS \*\/([\s\S]*?)\/\* #endregion GENERATED-ICONS \*\//);
    if (!gen) err('src/ui/style.css 里没有 GENERATED-ICONS 区块（跑 node tools/build-content.mjs 生成）');
    else {
      const defined = new Set([...gen[1].matchAll(/\.ico-([a-z0-9_]+) \{/g)].map((m) => m[1]));
      let missing = 0;
      for (const it of registry.icons) {
        if (!defined.has(it.name)) { err(`content/icons.json 的 ${it.name} 没有生成到 style.css 的 .ico-* 区块`); missing++; }
      }
      const pack = registry.icons.filter((i) => String(i.source).startsWith('pack:')).length;
      note(`图标注册表 ${registry.icons.length} 条（Game-Icon-Pack ${pack} + 本地素材 ${registry.icons.length - pack}），生成区块 ${defined.size} 条 .ico-*`);
      if (!missing && defined.size !== registry.icons.length) warn(`生成区块有 ${defined.size} 条 .ico-*，注册表有 ${registry.icons.length} 条（区块里可能有手写残留）`);
    }
  }
}

// ---------- 4. 卡牌池 / 招式池的健壮性 ----------
const byRarity = {};
for (const c of CARDS) byRarity[c.rarity] = (byRarity[c.rarity] ?? 0) + 1;
for (const r of Object.keys(RARITY)) {
  if (!byRarity[r]) err(`没有稀有度 ${r} 的卡牌`);
}
const zeroCost = CARDS.filter((c) => c.ap === 0).length;
if (zeroCost / CARDS.length > 0.45) warn(`0 费卡有 ${zeroCost}/${CARDS.length} 张，占比偏高（默认出战卡组会全是小牌）`);
/**
 * 招式池体检。招式池现在分两类：
 *   · 旧的四档池（weak/basic/strong/elite/boss）—— 敌人已经不再指向它们，留着是给诊断脚本用
 *   · 属性包 kit_<type> / kit_<type>_hi —— 每个敌人都按自己的属性挑一个
 * 无论哪一类，下面几条「实测被吐槽过的坑」都不能踩：
 *   ① 0 费还抽牌 = 白嫖价值（敌人的费用本来就不是限制）
 *   ② 低挡池不该有永久强化（小怪不该有成长性）—— 判定按**谁在用这个池**来算
 *   ③ 削弱牌不能扎堆（玩家会被磨到没法还手）
 *   ④ 降防御的牌不能太多
 */
const poolUsers = new Map();   // 池名 → 用它的敌人（含档位）
for (const e of ENEMIES) {
  const key = typeof e.deck === 'string' ? e.deck : null;
  if (!key) continue;
  if (!poolUsers.has(key)) poolUsers.set(key, []);
  poolUsers.get(key).push(e);
}

for (const [name, pool] of Object.entries(MOVE_POOLS)) {
  const powerOf = (id) => CARDS.find((c) => c.id === id)?.effects.filter((e) => e.kind === 'damage')
    .reduce((a, e) => a + e.power * (e.hits ?? 1), 0) ?? 0;
  const avg = pool.reduce((s, id) => s + powerOf(id), 0) / pool.length;
  // 威力是「攻击力百分比」：池子平均值超过 160% 就说明这个池子里的招太狠
  // （实测：敌人攻击 44 × 1.6 ≈ 70 点一下，一回合三四张就是玩家半管血）
  if (avg > 160) warn(`招式池 ${name} 的平均威力 ${avg.toFixed(1)}% 偏高（野生怪用强招会秒人）`);

  const cardsOf = pool.map((id) => CARDS.find((c) => c.id === id)).filter(Boolean);

  // ① 0 费还抽牌
  for (const c of cardsOf) {
    const draw = c.effects.filter((e) => e.kind === 'draw').reduce((s, e) => s + e.n, 0);
    if (c.ap === 0 && draw > 0) err(`招式池 ${name} 里有「0 费还抽牌」的卡「${c.name}」——敌人用它等于白拿价值`);
  }

  // ② 低挡使用者（野生 / 较强）不该拿到永久强化
  const users = poolUsers.get(name) ?? [];
  const usedByLowTier = users.some((e) => e.tier === 'mob' || e.tier === 'normal');
  const legacyLow = name === 'weak' || name === 'basic';
  if (usedByLowTier || legacyLow) {
    for (const c of cardsOf) {
      if (c.effects.some((e) => e.kind === 'buff' && ((e.amount ?? 0) > 0 || (e.pct ?? 0) > 0))) {
        err(`低挡招式池 ${name} 里有永久强化牌「${c.name}」——小怪不该有成长性`);
      }
    }
  }

  // ③ 削弱牌不能扎堆（只算**纯削弱**：带伤害的顺手降防属于攻击牌）
  const isPureDebuff = (c) => {
    if (c.effects.some((e) => e.kind === 'damage')) return false;
    return c.effects.some((e) => (e.kind === 'buff' && e.target === 'enemy' && ((e.amount ?? 0) < 0 || (e.pct ?? 0) < 0))
      || e.kind === 'status');
  };
  const debuffs = cardsOf.filter(isPureDebuff);
  if (debuffs.length / pool.length > 0.4) err(`招式池 ${name} 有 ${debuffs.length}/${pool.length} 张是削弱牌，占比过高（玩家会被磨到没法还手）`);

  // ④ 降防御的牌不能太多
  const defDown = cardsOf.filter((c) => c.effects.some((e) => e.kind === 'buff' && e.stat === 'def'
    && e.target === 'enemy' && ((e.amount ?? 0) < 0 || (e.pct ?? 0) < 0)));
  if (defDown.length > 3) err(`招式池 ${name} 有 ${defDown.length} 张「降防御」牌（上限 3）`);
}
for (const id of STARTER_DECK) if (!CARDS.find((c) => c.id === id)) err(`初始卡组的 ${id} 不存在`);
for (const id of STARTER_DECK) if (CARDS.find((c) => c.id === id)?.enemyOnly) err(`初始卡组里有敌人专用牌 ${id}`);
if (!CARDS.some((c) => c.effects?.some((e) => e.kind === 'cleanse'))) {
  warn('没有任何「清除属性下降」的卡牌 —— 削弱是永久叠加的，玩家会缺少解法');
}

// ---------- 4b. 敌人数值表的档位顺序 ----------
/**
 * **攻击力必须逐档递增**（每一章都满足 杂兵 < 较强 < 精英 < 首领）。
 *
 * 玩家反馈原话：「较强的怪甚至比 boss 都强，攻击力比 boss 强 5 倍不止，绝对有问题」。
 * 那次是推导工具的锅（给每档各自解攻击力，而攻击力是从「每点攻击造成多少伤害」反推的，
 * 卡组越强的档位反而解出越小的攻击力），但**光修工具不够** ——
 * 这个顺序是玩家一眼能看出来的东西，必须有一道门禁守住，谁改表都得过。
 */
{
  const ORDER = ['mob', 'normal', 'elite', 'boss'];
  const bad = [];
  for (let s = 0; s < BALANCE.enemyAtk[ORDER[0]].length; s++) {
    for (let i = 1; i < ORDER.length; i++) {
      const a = BALANCE.enemyAtk[ORDER[i - 1]][s];
      const b = BALANCE.enemyAtk[ORDER[i]][s];
      if (!(a < b)) bad.push(`第${s + 1}章 ${ORDER[i - 1]}(${a}) ≥ ${ORDER[i]}(${b})`);
    }
  }
  if (bad.length) err(`敌人攻击力没有逐档递增：${bad.join('、')}（玩家一眼就能看出「较强比首领还猛」）`);
  // 血量与攻击力逐章递增（章节越深越强）
  const notRising = [];
  for (const tier of ORDER) {
    for (let s = 1; s < BALANCE.enemyHp[tier].length; s++) {
      if (BALANCE.enemyHp[tier][s] < BALANCE.enemyHp[tier][s - 1]) notRising.push(`${tier} HP 第${s + 1}章`);
      if (BALANCE.enemyAtk[tier][s] < BALANCE.enemyAtk[tier][s - 1]) notRising.push(`${tier} ATK 第${s + 1}章`);
    }
  }
  if (notRising.length) err(`敌人数值没有逐章递增：${notRising.join('、')}`);
  // 首领的攻击力应当和玩家的攻击力在同一个档次
  // （拿「玩家攻击力上限」当参照，因为 BALANCE.player.atk 只是开局值 16，
  //   而第 6 章玩家的攻击力早就长到 57 上下了）
  const last = BALANCE.enemyAtk.boss.length - 1;
  const ratio = BALANCE.enemyAtk.boss[last] / BALANCE.cap.atk;
  if (ratio > 1.6) warn(`首领攻击力 ${BALANCE.enemyAtk.boss[last]} 是玩家攻击力上限（${BALANCE.cap.atk}）的 ${ratio.toFixed(1)} 倍，确认是不是又推歪了`);
  const rows = ORDER.map((t) => `${t} ${BALANCE.enemyAtk[t].join('/')}`);
  note(`敌人攻击力（逐档递增）：${rows.join(' ｜ ')}`);
}

// ---------- 5. BGM ----------
if (BGM_FILES) {
  const bgmDir = path.join(ROOT, 'assets', 'audio', 'bgm');
  for (const [key, file] of Object.entries(BGM_FILES)) {
    const p = path.join(bgmDir, file);
    if (!(await exists(p))) { err(`BGM 文件缺失：assets/audio/bgm/${file}（key=${key}）`); continue; }
    // 无缝循环靠 ogg(L) 素材 + WebAudio 的 AudioBuffer loop；mp3 版接缝处有编码器补的静音
    if (!file.endsWith('.ogg')) err(`BGM ${key} 不是 .ogg（无缝循环要求用上游的 ogg(L) 版素材）：${file}`);
    else {
      const head = await fs.readFile(p).then((b) => b.subarray(0, 4).toString('latin1')).catch(() => '');
      if (head !== 'OggS') err(`BGM ${key} 不是合法的 ogg 流（文件头是 ${JSON.stringify(head)}）：${file}`);
    }
  }
  const stale = (await fs.readdir(bgmDir).catch(() => [])).filter((f) => f.endsWith('.mp3'));
  if (stale.length) note(`assets/audio/bgm 里还留着 ${stale.length} 个已不再引用的 .mp3（不影响运行；想清掉就跑 & tools/fetch-bgm.ps1 -RemoveMp3）`);
  for (const key of STAGE_BIOME) {
    if (!BGM_FILES['map_' + key]) warn(`地图 ${key} 没有专属地图音乐（map_${key}），会退回默认曲`);
    if (!BGM_FILES['battle_' + key]) warn(`地图 ${key} 没有专属战斗音乐（battle_${key}），会退回默认曲`);
  }
}

// ---------- 6. 脚本编码（PowerShell 5.1 的坑）----------
// 这台机器上的 pwsh 其实是 Windows PowerShell 5.1：它会把**无 BOM 的 UTF-8 .ps1**
// 按本地代码页（GBK）解析，脚本里的中文注释/字符串会被拆坏 —— 轻则把乱码写进生成物
// （BGM 的 manifest.json 就这么中过一次），重则字符串提前结束、把后面的语句结构带歪。
// 所以 .ps1 / .cmd 一律只写 ASCII。
{
  const bad = [];
  for (const dir of [ROOT, path.join(ROOT, 'tools')]) {
    for (const f of await fs.readdir(dir).catch(() => [])) {
      if (!/\.(ps1|cmd)$/i.test(f)) continue;
      const p = path.join(dir, f);
      if (!(await fs.stat(p).catch(() => null))?.isFile()) continue;
      const buf = await fs.readFile(p);
      if (buf.some((b) => b > 127)) bad.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  }
  if (bad.length) note(`这些脚本里有非 ASCII 字节（PowerShell 5.1 会按本地代码页解析，可能乱码）：${bad.join('、')}`);
}

// ---------- 汇总 ----------
console.log('内容体检：');
console.log(`  卡牌 ${CARDS.length} · 敌人 ${ENEMIES.length}（${Object.keys(TIERS).map((t) => t + ' ' + ENEMIES.filter((e) => e.tier === t).length).join(' / ')}）`);
console.log(`  地图 ${stageCount} 章 · 事件 ${EVENTS.length} · 物种素材 ${speciesSlugs.size} 个 · 商人 ${MERCHANTS.length} 位`);
console.log(`  卡牌稀有度：${Object.entries(byRarity).map(([k, v]) => `${RARITY[k]?.name ?? k} ${v}`).join(' · ')}`);
for (const key of STAGE_BIOME) {
  const b = BIOMES[key];
  const enemies = ENEMIES.filter((e) => e.biome === key).length;
  const evs = EVENTS.filter((e) => e.biome === key).length;
  console.log(`    ${String(STAGE_BIOME.indexOf(key) + 1).padStart(2)}. ${b.name}（${key}）敌人 ${enemies} · 专属事件 ${evs} · HP 表 ${BALANCE.enemyHp.mob[STAGE_BIOME.indexOf(key)]}`);
}

if (notes.length) {
  console.log(`\n备注 ${notes.length} 条：`);
  for (const n of notes) console.log('  · ' + n);
}
if (warns.length) {
  console.log(`\n提醒 ${warns.length} 条：`);
  for (const w of warns) console.log('  · ' + w);
}
if (problems.length) {
  console.error(`\n发现 ${problems.length} 个问题：`);
  for (const p of problems) console.error('  ✗ ' + p);
  process.exit(1);
}
if (STRICT && warns.length) {
  console.error(`\n--strict：把 ${warns.length} 条提醒也算失败。`);
  process.exit(1);
}
console.log('\n内容体检通过 ✓');
