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
const { STATUS_INFO } = await import('../src/core/battle.js');

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

/**
 * 回合立绘（assets/gen9）也必须齐全 —— 每个物种的正面 + 背面。
 *
 * 起因：遭遇演出改成用**回合立绘**（用户点名「我表示的立绘是放在表示回合数旁边的那个立绘」），
 * 而上一轮加的那 12 只强敌只有 PMD 行走图、没有立绘。那场演出对缺图是**静默降级**的
 * （宁可少画一只也不出破图），所以缺了没人会发现 —— 只有门禁拦得住。
 * 补图：tools/import-gen9.mjs（它读 content/species.json，所以加完物种直接跑它就行）。
 */
let missingArt = 0;
for (const slug of speciesSlugs) {
  for (const kind of ['front', 'back']) {
    if (!(await exists(path.join(ROOT, 'assets', 'gen9', slug, kind + '.png')))) {
      err(`缺少回合立绘 assets/gen9/${slug}/${kind}.png`);
      missingArt++;
    }
  }
}
if (missingArt) warn('立绘缺失：先把 Generation 9 Pack 解到 %TEMP%\\gen9x，再跑 node tools/import-gen9.mjs');

/**
 * 精灵表的切分必须和图片尺寸严丝合缝，而且 **Idle 至少要 8 帧**。
 *
 * 起因（玩家反馈）：「大针蜂的行走图有问题」—— 战斗里它显示成一堆小蜜蜂铺满屏幕。
 * 根因：SpriteCollab 的 AnimData 里，大针蜂的 Idle 写的是 `<CopyOf>Walk</CopyOf>`（不写自己的帧尺寸），
 * tools/build-sprite-meta.mjs 当时不认识这个标签，fw/fh 读成 undefined，
 * 于是走了「整张图当一帧」的兜底 —— 128×384 的精灵表被当成一张立绘画了出来。
 * 这条门禁把「切不出来」这件事直接拦在提交之前：帧尺寸乘回去必须等于图片尺寸，
 * 而且 Idle 的帧数不能小于 8（PMD 的精灵表永远是 8 行 = 8 个朝向）。
 */
{
  const metaPath = path.join(ROOT, 'assets', 'data', 'sprites.json');
  const meta = await fs.readFile(metaPath, 'utf8').then(JSON.parse).catch(() => null);
  if (!meta) err('assets/data/sprites.json 读不出来（跑 node tools/build-sprite-meta.mjs 生成）');
  else {
    const bad = [];
    for (const slug of speciesSlugs) {
      const anims = meta[slug]?.anims;
      if (!anims) { bad.push(`${slug}: 没有元数据`); continue; }
      for (const a of needAnims) {
        const v = anims[a];
        if (!v) { bad.push(`${slug}/${a}: 元数据里没有这一条`); continue; }
        const p = path.join(ROOT, 'assets', 'pokemon', slug, a + '.png');
        const buf = await fs.readFile(p).catch(() => null);
        if (!buf) continue;   // 缺图上面已经报过了
        const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
        if (v.fw * v.cols !== w || v.fh * v.rows !== h || v.frames !== v.cols * v.rows) {
          bad.push(`${slug}/${a}: 元数据 ${v.fw}×${v.fh} × ${v.cols}×${v.rows} 对不上图片 ${w}×${h}`);
        }
        if (a === 'Idle' && v.frames < 8) {
          bad.push(`${slug}/Idle: 只有 ${v.frames} 帧（PMD 精灵表是 8 行朝向，切不出来才会变成 1 帧——"整张图当一帧"）`);
        }
      }
    }
    if (bad.length) err(`精灵表切分有问题：${bad.slice(0, 6).join('、')}${bad.length > 6 ? ` …共 ${bad.length} 条` : ''}（跑 node tools/build-sprite-meta.mjs 重新生成）`);
  }
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
 * 卡面里写死的**护盾公式系数**必须和引擎一致。
 *
 * 引擎算护盾是 `round(amount × (1 + 防御 ÷ 12))`（见 battle.js 的 case 'shield'），
 * 换算成人话就是「约 amount + 防御 × amount÷12」。有些卡把这句话印在了卡面上
 * （「获得护盾（随防御成长，约 9 + 防御×0.75）」），而这两个数字是**手抄**的 ——
 * 「缩入壳中」的基数改成 13 之后系数没跟着改，卡面写着 ×0.75、实际是 ×1.08，
 * 玩家照着卡面算出来的护盾会比实际少三成。这条门禁把两个数字都对一遍。
 */
{
  const DEF_DIVISOR = 12;
  let shieldTexts = 0;
  for (const c of CARDS) {
    const m = (c.text ?? '').match(/随防御成长[^）]*?约\s*(\d+)\s*\+\s*防御\s*×\s*([\d.]+)/);
    if (!m) continue;
    shieldTexts++;
    const sh = (c.effects ?? []).find((e) => e.kind === 'shield');
    if (!sh) { err(`【${c.name}】卡面写了护盾公式，但 effects 里没有 shield`); continue; }
    if (!sh.scaleWithDef) { err(`【${c.name}】卡面写了「随防御成长」，但 shield 效果没有 scaleWithDef`); continue; }
    const wantBase = Number(m[1]);
    const wantMul = Number(m[2]);
    const realMul = sh.amount / DEF_DIVISOR;
    if (sh.amount !== wantBase) err(`【${c.name}】护盾基数：卡面写 ${wantBase}，effects.amount = ${sh.amount}`);
    if (Math.abs(realMul - wantMul) > 0.005) {
      err(`【${c.name}】护盾的防御系数：卡面写 ×${wantMul}，实际是 ×${realMul.toFixed(2)}（= amount ÷ ${DEF_DIVISOR}）`);
    }
  }
  if (shieldTexts) note(`卡面印了护盾公式的卡 ${shieldTexts} 张，系数已和引擎（amount ÷ ${DEF_DIVISOR}）对过`);
}

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

// ---------- 7. 状态胶囊：JS 的倒计时必须和 CSS 的动画时长一致 ----------
// 胶囊退场时是「先播 CSS 动画，再由 JS 的定时器把节点摘掉」。两边的时长一旦不一致：
//   · JS 更短 → 动画还没放完节点就没了（看着像卡掉一帧）
//   · JS 更长 → 胶囊看不见了但还占着那一格，整排会「顿」一下
// 这两个数字以前只能靠人对眼，现在钉在体检里。
{
  const css = await fs.readFile(path.join(ROOT, 'src/ui/style.css'), 'utf8');
  const js = await fs.readFile(path.join(ROOT, 'src/ui/battle-view.js'), 'utf8');
  const cssMs = Number((css.match(/animation:\s*chipOut\s+([\d.]+)s/) ?? [])[1]) * 1000;
  const jsMs = Number((js.match(/const CHIP_OUT_MS\s*=\s*(\d+)/) ?? [])[1]);
  if (!cssMs) problems.push('style.css 里找不到 .status-chip 的 chipOut 动画（状态胶囊的退场动画）');
  else if (!jsMs) problems.push('battle-view.js 里找不到 CHIP_OUT_MS（胶囊退场后摘节点的延时）');
  else if (cssMs !== jsMs) problems.push(`胶囊退场：CSS 动画 ${cssMs}ms ≠ JS 摘节点 ${jsMs}ms（两边必须一致，见 style.css 的 chipOut 与 battle-view.js 的 CHIP_OUT_MS）`);
  else note(`状态胶囊退场：CSS 与 JS 都是 ${jsMs}ms（入场 / 层数变化 / 退场三套动画见 style.css）`);
}

// ---------- 7. 字体子集是不是过期了 ----------
/**
 * 这一条治的是真出过的事故：上一轮我重写了 46 个事件的旁白，加了一堆「呀 / 诶 / 唔 / 哟」，
 * 却忘了重跑 tools/subset-fonts.mjs —— 于是发出去的**子集**里没有这些字（子集是内容文本的旧快照），
 * 它们在页面上一个字一个字掉到黑体兜底上。玩家看到的结论是「这个字体严重缺字」，
 * 而真相是子集过期（字体本身一个都不缺）。这类错误肉眼只能看出「字不对」，量不出原因，
 * 所以在体检里钉死：**子集的内容指纹必须等于现在的内容文本**。
 */
{
  const { createHash } = await import('node:crypto');
  const manifestFile = path.join(ROOT, 'assets/fonts/subset-manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8').catch(() => 'null'));
  if (!manifest) {
    err('assets/fonts/subset-manifest.json 不存在 —— 跑一次 node tools/subset-fonts.mjs 生成字体子集与清单');
  } else {
    const SCAN = [{ dir: 'content', ext: ['.json'] }, { dir: 'src', ext: ['.js'] }, { dir: 'tools', ext: ['.js'] }];
    const ALWAYS = [
      ' !"#$%&\'()*+,-./0123456789:;<=>?@',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`',
      'abcdefghijklmnopqrstuvwxyz{|}~',
      '　、。〈〉《》「」『』【】〔〕・ーー—–…‘’“”′″¥￥×÷±°％‰＃＆＊＠',
      '，．；：？！（）［］｛｝＜＞＝＋－／＼｜～＄　',
      '０１２３４５６７８９',
      '←→↑↓★☆●○◆◇■□▲▼♪♭†‡§¶',
    ];
    const walk = async (dir, exts, out) => {
      for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) await walk(p, exts, out); }
        else if (exts.includes(path.extname(e.name).toLowerCase())) out.push(p);
      }
    };
    const files = [];
    for (const s of SCAN) await walk(path.join(ROOT, s.dir), s.ext, files);
    files.push(path.join(ROOT, 'index.html'));
    const chars = new Set(ALWAYS.join(''));
    for (const f of files) {
      for (const ch of await fs.readFile(f, 'utf8')) {
        const cp = ch.codePointAt(0);
        if (cp < 0x20 || (cp >= 0xe000 && cp <= 0xf8ff)) continue;
        chars.add(ch);
      }
    }
    const text = [...chars].join('');
    const sha = createHash('sha256').update(text, 'utf8').digest('hex');
    if (sha !== manifest.textSha256) {
      err(`字体子集过期了：内容文本已经变了（${manifest.chars} 字 → ${chars.size} 字），`
        + '但它们裁出来的 assets/fonts/*-subset.woff2 还是旧快照 —— '
        + '跑一次 node tools/subset-fonts.mjs 重裁（不然新写的字会掉到兜底字体上）');
    } else {
      note(`字体子集与内容一致（${manifest.chars} 字，指纹 ${sha.slice(0, 12)}）`);
    }
    for (const f of manifest.fonts) {
      const p = path.join(ROOT, 'assets/fonts', f.out);
      const st = await fs.stat(p).catch(() => null);
      if (!st) err(`清单里列了 ${f.out}，但 assets/fonts 里没有这个文件`);
      else if (st.size !== f.outBytes) err(`${f.out} 的大小和清单对不上（${st.size} vs ${f.outBytes}）—— 重新跑一遍 subset-fonts.mjs`);
    }
    if (manifest.patch) {
      const p = path.join(ROOT, 'assets/fonts', manifest.patch.out);
      if (!(await fs.stat(p).catch(() => null))) err(`清单里列了补丁子集 ${manifest.patch.out}，但文件不在`);
      else if (manifest.patch.stillMissing) {
        note(`手写体补丁也补不上的字（只能落兜底字体）：${manifest.patch.stillMissing}`);
      }
      // 补丁子集本来就只含那几个字，缺多说明裁歪了
      if (manifest.patch.wants === 0) warn('手写体一个字都不缺，补丁子集其实是多余的（可以把它从 CSS 与清单里去掉）');
    }
  }
}

// ---------- 8. 多语言：孤儿译文 ----------
/**
 * 这一条治的是「翻译悄悄失效」：短语表的键**就是中文原文**，
 * 所以源文案改一个字（哪怕只是加个逗号），旧译文就再也匹配不上、变成孤儿 ——
 * 界面上会静默退回中文，谁也不会发现。build-i18n.mjs 扫源码时会算出来写进 _report.json，
 * 这里只负责把它当门禁用。
 */
{
  const report = JSON.parse(await fs.readFile(path.join(ROOT, 'content/i18n/_report.json'), 'utf8').catch(() => 'null'));
  if (!report) {
    note('还没有多语言报表（content/i18n/_report.json）—— 跑一次 node tools/build-i18n.mjs 就有了');
  } else {
    const langs = Object.entries(report.perLang ?? {});
    note(`多语言：${langs.map(([lg, s]) => `${lg} ${s.done}/${s.total}（${s.percent}%）`).join(' · ')}`
      + `（界面文案 + 内容，共 ${report.neededTotal} 条待翻）`);
    for (const [lg, list] of Object.entries(report.orphans ?? {})) {
      if (list?.length) {
        err(`多语言 ${lg} 有 ${list.length} 条**孤儿**译文（源文案改过，译文再也匹配不上，界面上会静默退回中文）：`
          + `${list.slice(0, 6).map((s) => JSON.stringify(s)).join('、')}${list.length > 6 ? ' …' : ''}`
          + ' —— 要么把译文改成新原文，要么删掉它');
      }
    }
    // 占位符对不上 = 界面上会少一个数字（「造成 点伤害。」），比缺翻译还难看，所以也是硬错误
    const holes = report.placeholders ?? [];
    if (holes.length) {
      err(`多语言有 ${holes.length} 条译文的占位符对不上（{d} / {K} 这类必须原样保留，少一个界面上就少一个数字）：`
        + `${holes.slice(0, 3).join(' ｜ ')}${holes.length > 3 ? ' …' : ''}`);
    }

    /**
     * 译文里混着中文。
     *
     * 为什么是**一份手写的小词表**而不是「有汉字就报」：中日共用汉字，日文里出现汉字完全正常
     * （地面 / 吸血 / 出血 / 敏捷 / 威力 都是正经日语词，拿它们当判据会淹掉真问题）。
     * 所以只列那些**日文里根本不会这么写**的词 —— 换句话说，出现即漏翻。
     * 这条不是空想出来的：`引爆` 就漏了四处（`引爆 ×{n}`、`…を引爆した！`、help 页的 `<code>引爆</code>`），
     * 而当时所有体检都是绿的。
     */
    const CN_ONLY = ['引爆', '出牌', '抽牌', '手牌', '牌堆', '洗牌', '卡池', '回合', '玩家', '播放', '手感', '战力', '强弱', '无视'];
    for (const lg of ['ja', 'en']) {
      const dict = JSON.parse(await fs.readFile(path.join(ROOT, `content/i18n/${lg}.json`), 'utf8').catch(() => '{}'));
      const hits = [];
      for (const [zh, v] of Object.entries(dict)) {
        const found = CN_ONLY.filter((w) => String(v).includes(w));
        if (found.length) hits.push(`${JSON.stringify(zh.slice(0, 24))} → ${JSON.stringify(String(v).slice(0, 40))}（${found.join('、')}）`);
      }
      if (hits.length) {
        err(`多语言 ${lg} 有 ${hits.length} 条译文里残留中文专有词（这类词日文里不会这么写，出现即漏翻）：`
          + `${hits.slice(0, 3).join(' ｜ ')}${hits.length > 3 ? ' …' : ''}`);
      }
    }
  }
}

// ---------- 9. 日文专有名词的写法（宝可梦原版风格） ----------
/**
 * 用户要求：「招式名称应该模仿宝可梦原版只出现片假名或是平假名而没有汉字」。
 *
 * 宝可梦日文原版的命名习惯就是这样：**招式名、道具名、属性名、物种名一律不写汉字**
 * （たいあたり／キズぐすり／じめん／フライゴン），**状态名连片假名都不用、全平假名**
 * （どく／もうどく／やけど／まひ）；汉字只出现在说明文里。
 * 名片上出现「流砂の落とし穴」或「弱体」这种写法，一眼就不像宝可梦。
 *
 * 所以这里当门禁卡住：招式名（卡名）与道具名一旦冒出汉字就报错 ——
 * 新加的卡很容易顺手写成汉字名，靠人盯是盯不住的。
 */
{
  const jaPath = path.join(ROOT, 'content/i18n/ja.json');
  const ja = JSON.parse(await fs.readFile(jaPath, 'utf8').catch(() => '{}'));
  const KANJI = /[\u3400-\u4dbf\u4e00-\u9fff]/;
  const HIRA_ONLY = /[^\u3041-\u3096\u309d\u309eー]/;   // 平假名 + 长音符，别的都不许有
  const bad = [];
  for (const c of CARDS) if (ja[c.name] && KANJI.test(ja[c.name])) bad.push(`招式「${c.name}」→「${ja[c.name]}」`);
  for (const it of Object.values(ITEMS)) if (ja[it.name] && KANJI.test(ja[it.name])) bad.push(`道具「${it.name}」→「${ja[it.name]}」`);
  const species = [...new Set(ENEMIES.map((e) => e.name))];
  for (const n of species) if (ja[n] && KANJI.test(ja[n])) bad.push(`物种「${n}」→「${ja[n]}」`);
  const types = [...new Set(ENEMIES.flatMap((e) => e.types ?? []))];
  for (const n of types) if (ja[n] && KANJI.test(ja[n])) bad.push(`属性「${n}」→「${ja[n]}」`);
  const statuses = Object.values(STATUS_INFO).map((s) => [s.name, ja[s.name] ?? s.name]);
  for (const [zh, v] of statuses) if (HIRA_ONLY.test(v)) bad.push(`状态「${zh}」→「${v}」（要全平假名）`);
  // 卡名撞车：两张不同的卡翻成同一个名字，玩家在手里根本分不出谁是谁（第一次跑就抓到三组）
  for (const [lg, dict] of [['ja', ja], ['en', JSON.parse(await fs.readFile(path.join(ROOT, 'content/i18n/en.json'), 'utf8').catch(() => '{}'))]]) {
    const seen = new Map();
    for (const c of CARDS) {
      const v = dict[c.name];
      if (!v) continue;
      if (!seen.has(v)) seen.set(v, []);
      seen.get(v).push(c.name);
    }
    for (const [v, names] of seen) if (names.length > 1) bad.push(`${lg} 卡名撞车：「${v}」同时是 ${names.join(' / ')}`);
  }
  if (bad.length) {
    err(`日文专有名词的写法不像宝可梦原版（招式 / 道具 / 属性 / 物种名一律用假名、不写汉字；状态名要全平假名），或有卡名撞车：`
      + `${bad.slice(0, 8).join('、')}${bad.length > 8 ? ' …' : ''}`);
  } else {
    note(`日文招式 / 道具 / 属性 / 物种名 ${CARDS.length + Object.keys(ITEMS).length + species.length + types.length} 条无汉字`
      + `、状态名 ${statuses.length} 条全平假名 —— 和宝可梦原版一致`);
  }
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
