// 内容管线：把 content/*.json 校验后生成到 src/data/*.js 里的「生成区块」。
//
// 为什么要这样：加内容（卡牌 / 敌人 / 地图 / 事件）以前要改 4 个 JS 文件、
// 还容易漏掉素材或写错 id。现在唯一数据源是 content/ 下的 JSON：
//   1. 加/改 content/*.json（或 content/events/*.json）
//   2. node tools/build-content.mjs     ← 校验 + 生成
//   3. node tools/check-content.mjs     ← 再对素材（精灵图/头像/图标）做一次体检
//
// 生成区块用注释标记包起来，脚本只替换标记之间的内容，其它代码一个字都不动：
//   // #region GENERATED-CARDS
//   // #endregion GENERATED-CARDS
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const CONTENT = path.join(ROOT, 'content');

// 战斗引擎能解释的效果种类（改 battle.js 的 resolveEffect 时要同步这里）
const ENGINE_EFFECT_KINDS = ['damage', 'shield', 'heal', 'draw', 'ap', 'apBonus', 'plays', 'buff', 'status', 'strength', 'detonate', 'statusDouble', 'statusSteal', 'selfDmg', 'discard', 'exhaustHand', 'cleanse'];
const STATUS_KINDS = ['poison', 'toxic', 'burn', 'weak', 'bleed'];
const BUFF_STATS = ['atk', 'def', 'agi', 'luck'];
const RARITIES = ['common', 'uncommon', 'rare', 'epic'];
const TIERS = ['mob', 'normal', 'elite', 'boss'];

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

async function loadAll() {
  const cards = await readJson(path.join(CONTENT, 'cards.json'));
  const icons = await readJson(path.join(CONTENT, 'icons.json'));
  const species = await readJson(path.join(CONTENT, 'species.json'));
  const enemies = await readJson(path.join(CONTENT, 'enemies.json'));
  const biomes = await readJson(path.join(CONTENT, 'biomes.json'));
  const eventsDir = path.join(CONTENT, 'events');
  const files = (await fs.readdir(eventsDir)).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort();
  const events = [];
  for (const f of files) {
    const list = await readJson(path.join(eventsDir, f));
    if (!Array.isArray(list)) { err(`content/events/${f} 必须是一个数组`); continue; }
    for (const ev of list) events.push({ ...ev, _file: `events/${f}` });
  }
  const bgm = await readJson(path.join(CONTENT, 'bgm.json'));
  const merchants = await readJson(path.join(CONTENT, 'merchants.json'));
  // fetch-bgm.ps1 抓下来的「上游 mp3 名 -> ogg(L) 下载地址」对照表，用来在构建期
  // 就发现选曲表里写错的 mp3 文件名（没有这个文件也能构建，只是不做这项校验）
  const oggMap = await readJson(path.join(ROOT, 'tools', 'bgm-ogg-map.json')).catch(() => null);
  // t1 侦察留下的选型快照与图标目录：用来校验 content/icons.json 里的 pack:<component_name>
  // 真的是那个包里存在的图标（也顺便知道它属于哪个分类目录，好拼下载 URL）
  const iconCatalog = await readJson(path.join(ROOT, 'tools', 'icon-catalog.json')).catch(() => []);
  const iconDraft = await readJson(path.join(ROOT, 'tools', 'icon-semantics-draft.json')).catch(() => null);
  return { cards, species, enemies, biomes, events, bgm, oggMap, icons, iconCatalog, iconDraft, merchants };
}

// ============================================================
// 校验
// ============================================================

/**
 * 图标注册表校验 + 把图标解析成「CSS 里的 url() 该怎么写」。
 *
 * content/icons.json 是图标的唯一数据源，style.css 的 GENERATED-ICONS 区块由它生成。
 * 两条硬约束（t1 实测踩出来的）在这里卡住，别让它们悄悄漏过去：
 *   1. 类名只能是 [a-z0-9_]：`.ico-dragon-breath` 会让 check-icons.mjs 误报「ico-dragon 未定义」，
 *      `.ico-AP` 会被 CSS 直接丢弃（大写不在选择器的字符集里）。
 *   2. url 必须是 `../../assets/...`：bundle.mjs 靠这个前缀把 CSS 里的素材内联成 data URI
 *      （它只认 `assets/` 开头的路径），写成别的形式单文件包会缺图。
 */
async function resolveIcons(registry, componentCategory) {
  const list = registry?.icons;
  if (!Array.isArray(list) || !list.length) {
    err('content/icons.json 缺 icons 数组（图标注册表是唯一数据源，不能为空）');
    return [];
  }
  const seen = new Map();
  const out = [];
  for (const it of list) {
    const at = `图标「${it?.name ?? '?'}」`;
    if (!it || typeof it !== 'object') { err('content/icons.json 里有个条目不是对象'); continue; }
    if (!it.name) { err('content/icons.json 里有个条目没有 name'); continue; }
    if (!/^[a-z0-9_]+$/.test(it.name)) {
      err(`${at} 的 name 只能是 [a-z0-9_]（小写字母/数字/下划线）：不能用连字符、不能用大写，否则 CSS 选择器会丢弃它、或 check-icons.mjs 会把它解析成另一个名字`);
    }
    if (seen.has(it.name)) err(`图标名重复：${it.name}（第 ${seen.get(it.name)} 条和第 ${list.indexOf(it) + 1} 条）`);
    else seen.set(it.name, list.indexOf(it) + 1);
    if (!it.desc) err(`${at} 缺 desc（用途说明，给人和后续 agent 看的）`);
    if (!it.group) warn(`${at} 没有 group（会归到「未分组」，只是生成区块里的注释分节）`);

    const source = String(it.source ?? '');
    if (!/^pack:/.test(source) && !/^local:/.test(source)) {
      err(`${at} 的 source=${JSON.stringify(it.source)} 不认识：只能是 pack:<Game-Icon-Pack 的 component_name> 或 local:<assets/img 下的相对路径>`);
      continue;
    }

    const fileRel = it.file ?? (source.startsWith('local:') ? null : `icons/${it.name}.png`);
    if (!fileRel || typeof fileRel !== 'string') { err(`${at} 缺 file`); continue; }
    const rel = fileRel.replace(/^\/+/, '');
    if (path.isAbsolute(rel) || rel.includes('..')) { err(`${at} 的 file=${fileRel} 必须是 assets/img 下的相对路径，不能用绝对路径或 ..`); continue; }
    const abs = path.join(ROOT, 'assets', 'img', rel);
    if (!(await fs.stat(abs).catch(() => null))?.isFile()) {
      const hint = source.startsWith('pack:')
        ? ' —— 先跑 & tools/fetch-iconpack.ps1 下载（只下用到的那些）'
        : ' —— local: 源指向的是现有素材，路径写错了吗？';
      err(`${at} 的素材文件不存在：assets/img/${rel}${hint}`);
      continue;
    }
    const ext = path.extname(rel).toLowerCase();
    if (!['.png', '.svg'].includes(ext)) { err(`${at} 的素材格式 ${ext} 不支持（只支持 .png / .svg）`); continue; }

    if (source.startsWith('pack:')) {
      const component = source.slice(5);
      if (!component) { err(`${at} 的 source 是空的 pack:`); continue; }
      const cat = componentCategory.get(component);
      if (!cat) {
        err(`${at} 的 pack:${component} 不在 tools/icon-catalog.json 里（不是 Game-Icon-Pack 的 component_name），拼不出下载地址`);
        continue;
      }
      if (it.component && it.component !== component) warn(`${at} 的 component=${it.component} 和 source 里的 ${component} 不一致`);
      if (it.category && it.category !== cat) warn(`${at} 的 category=${it.category} 和 catalog 里的 ${cat} 不一致`);
      if (ext !== '.svg') err(`${at} 是 pack 源，素材必须是 no-padding 的 .svg（仓库里没有 png，PNG 只在 release 的 7z 里）`);
      const svg = await fs.readFile(abs, 'utf8');
      const root = svg.match(/<svg\b[^>]*>/)?.[0];
      if (!root) err(`${at} 的 assets/img/${rel} 不是一个 SVG（没有 <svg> 根节点）`);
      else if (!/fill\s*=\s*["']currentColor["']/.test(root)) {
        err(`${at} 的 SVG 根节点不是 fill="currentColor"（用 mask 会取不到形状；t1 报告要求直接用原样下载的 no-padding SVG）`);
      }
      out.push({ name: it.name, desc: it.desc, group: it.group ?? '未分组', source, component, category: cat, rel, url: `../../assets/img/${rel}` });
    } else {
      const localRel = source.slice(6);
      // source 指的是 assets/img 下的文件，file 是它的「图标目录相对路径」写法；
      // 只有文件名本身对不上才提醒（例如 source=local:cards/sword.png 但 file=icons/sword.png）
      if (path.basename(localRel) !== path.basename(rel)) warn(`${at} 的 source=${source} 和 file=${fileRel} 文件名不一致（以 file 为准）`);
      if (ext !== '.png') warn(`${at} 是 local 源但素材不是 .png（${ext}）：确认这是有意的`);
      out.push({ name: it.name, desc: it.desc, group: it.group ?? '未分组', source, rel, url: `../../assets/img/${rel}` });
    }
  }
  return out;
}

function validateCards(data, iconNames) {
  const { cards, items, starterDeck } = data;
  if (!Array.isArray(cards)) return err('cards.json 缺少 cards 数组');
  const ids = new Set();
  for (const c of cards) {
    const at = `卡牌「${c.id ?? '?'}」`;
    for (const k of ['id', 'name', 'rarity', 'targeting', 'text', 'ico', 'fx']) {
      if (c[k] == null) err(`${at} 缺字段 ${k}`);
    }
    if (c.ap == null || !Number.isInteger(c.ap) || c.ap < 0 || c.ap > 5) err(`${at} 的 ap 必须是 0~5 的整数`);
    if (!RARITIES.includes(c.rarity)) err(`${at} 的 rarity 必须是 ${RARITIES.join('/')}`);
    if (!['enemy', 'self'].includes(c.targeting)) err(`${at} 的 targeting 必须是 enemy/self`);
    if (!Array.isArray(c.effects) || !c.effects.length) err(`${at} 至少要有一个 effects`);
    for (const eff of c.effects ?? []) {
      if (!ENGINE_EFFECT_KINDS.includes(eff.kind)) err(`${at} 用了引擎不认识的效果 kind=${eff.kind}`);
      if (eff.kind === 'buff') {
        if (!BUFF_STATS.includes(eff.stat)) err(`${at} 的 buff stat 必须是 ${BUFF_STATS.join('/')}`);
        // amount（固定值）和 pct（按目标基础属性的百分比）二选一
        if (typeof eff.amount !== 'number' && typeof eff.pct !== 'number') err(`${at} 的 buff 缺 amount / pct`);
      }
      if (eff.kind === 'strength' && typeof eff.n !== 'number') err(`${at} 的 strength 缺 n`);
      if (eff.kind === 'plays' && typeof eff.n !== 'number') err(`${at} 的 plays 缺 n`);
      if (eff.kind === 'apBonus' && typeof eff.n !== 'number') err(`${at} 的 apBonus 缺 n`);
      if (eff.kind === 'selfDmg' && typeof eff.amount !== 'number' && typeof eff.pct !== 'number') err(`${at} 的 selfDmg 缺 amount / pct`);
      // 伤害的几种条件加成（见 battle.js 的 damagePowerOf）：字段名写错就等于没生效，所以逐个卡一遍
      if (eff.kind === 'damage') {
        if (eff.bonusPerStack) {
          const st = eff.bonusPerStack.status;
          for (const s of (Array.isArray(st) ? st : [st])) {
            if (!STATUS_KINDS.includes(s)) err(`${at} 的 bonusPerStack.status=${s} 不是已知状态`);
          }
          if (typeof eff.bonusPerStack.per !== 'number') err(`${at} 的 bonusPerStack 缺 per`);
        }
        if (eff.plusShield != null && typeof eff.plusShield !== 'number') err(`${at} 的 plusShield 必须是数字`);
        if (eff.execThreshold != null && typeof eff.execBonus !== 'number') err(`${at} 有 execThreshold 但没有 execBonus`);
      }
      if (eff.kind === 'shield' && eff.keep != null && typeof eff.keep !== 'boolean') err(`${at} 的 shield.keep 必须是 true/false`);
      // 威力改成「攻击力的百分比」之后，卡面上写死的伤害数字必须是 {d} 占位符
      // （否则第 2 章起卡面就是错的，见 tools/placeholder-damage-text.mjs）
      if (eff.kind === 'damage' && typeof eff.power !== 'number') err(`${at} 的伤害效果缺 power`);
      if (eff.kind === 'damage' && (eff.power < 5 || eff.power > 900)) {
        warn(`${at} 的威力 ${eff.power} 不在 5~900（攻击力百分比）区间里，确认一下是不是漏乘了 100`);
      }
      if (eff.kind === 'status' && !STATUS_KINDS.includes(eff.status)) err(`${at} 的 status 必须是 ${STATUS_KINDS.join('/')}`);
      if (eff.kind === 'draw' && typeof eff.n !== 'number') err(`${at} 的 draw 缺 n`);
      if (eff.kind === 'shield' && typeof eff.amount !== 'number') err(`${at} 的 shield 缺 amount`);
      if (eff.kind === 'heal' && typeof eff.amount !== 'number' && typeof eff.pct !== 'number') err(`${at} 的 heal 缺 amount/pct`);
    }
    // 文本里的数字应当和效果一致（只做提醒，不拦）
    if (c.effects?.some((e) => e.kind === 'damage') && !/伤害|威力|造成/.test(c.text ?? '')) {
      warn(`卡牌「${c.id}」有效果但描述里没提伤害：${c.text}`);
    }
    if (ids.has(c.id)) err(`卡牌 id 重复：${c.id}`);
    ids.add(c.id);
    // 卡面图标必须是注册过的 ico-* 类名：写错了界面上只会显示一个空白方块
    if (iconNames.size && c.ico && !iconNames.has(String(c.ico).replace(/^ico-/, ''))) {
      err(`${at} 的 ico=${c.ico} 不在 content/icons.json 里（先在图标注册表里登记，再跑 node tools/build-content.mjs）`);
    }
  }
  for (const id of starterDeck ?? []) if (!ids.has(id)) err(`初始卡组里的 ${id} 不在卡牌表里`);
  for (const [key, it] of Object.entries(items ?? {})) {
    if (it.id !== key) err(`道具 ${key} 的 id 字段（${it.id}）和键名不一致`);
    if (!['flask_half', 'flask_full', 'star_1', 'sword', 'shield', 'spark_1'].includes(it.art)) {
      warn(`道具 ${key} 的 art=${it.art} 可能没有对应图标`);
    }
  }
  return cards.map((c) => c.id);
}

function validateSpecies(species, enemyList) {
  const slugs = new Set(Object.keys(species?.species ?? {}));
  for (const [slug, s] of Object.entries(species?.species ?? {})) {
    if (!/^\d{4}$/.test(String(s.dex ?? ''))) err(`物种 ${slug} 的 dex 必须是 4 位数字串`);
    if (s.slug !== slug) err(`物种 ${slug} 的 slug 字段（${s.slug}）和键名不一致`);
    for (const k of ['name', 'en', 'types']) if (s[k] == null) err(`物种 ${slug} 缺字段 ${k}`);
  }
  for (const e of enemyList) if (!slugs.has(e.slug)) err(`敌人 ${e.id} 的 slug=${e.slug} 不在 species.json 里`);
  return slugs;
}

function validateEnemies(data, cardIds, biomeKeys) {
  const { enemies, movePools, tiers } = data;
  const ids = new Set();
  const cards = new Set(cardIds);
  for (const [name, pool] of Object.entries(movePools ?? {})) {
    if (!Array.isArray(pool) || !pool.length) err(`招式池 ${name} 不能为空`);
    for (const id of pool) if (!cards.has(id)) err(`招式池 ${name} 引用了不存在的卡牌 ${id}`);
  }
  for (const e of enemies) {
    const at = `敌人「${e.id}」`;
    for (const k of ['id', 'slug', 'tier', 'biome', 'deck', 'lines']) if (e[k] == null) err(`${at} 缺字段 ${k}`);
    if (!TIERS.includes(e.tier)) err(`${at} 的 tier 必须是 ${TIERS.join('/')}`);
    if (!biomeKeys.includes(e.biome)) err(`${at} 的 biome=${e.biome} 不在 biomes.json 里`);
    if (!Array.isArray(e.lines) || !e.lines.length) err(`${at} 至少要有一句台词`);
    const deck = e.deck;
    if (typeof deck === 'string') {
      if (!movePools[deck]) err(`${at} 的 deck="${deck}" 不是已定义的招式池`);
    } else if (Array.isArray(deck)) {
      for (const id of deck) if (!cards.has(id)) err(`${at} 的 deck 引用了不存在的卡牌 ${id}`);
    } else err(`${at} 的 deck 必须是招式池名或卡牌 id 数组`);
    for (const id of e.signature ?? []) {
      if (!cards.has(id)) err(`${at} 的专属招式 ${id} 不存在`);
    }
    if (e.tier === 'boss' && !(e.signature?.length)) warn(`${at} 是首领但没有专属招式（signature）`);
    if (e.tier === 'boss' && !e.bossTitle) warn(`${at} 是首领但没有 bossTitle`);
    if (ids.has(e.id)) err(`敌人 id 重复：${e.id}`);
    ids.add(e.id);
  }
  for (const t of Object.keys(tiers ?? {})) {
    if (!TIERS.includes(t)) err(`tiers 里有未知档位 ${t}`);
  }
  return ids;
}

function validateBiomes(data, enemyList) {
  const { stageOrder, biomes } = data;
  const keys = Object.keys(biomes ?? {});
  if (!Array.isArray(stageOrder) || !stageOrder.length) err('biomes.json 缺 stageOrder');
  for (const k of stageOrder ?? []) if (!keys.includes(k)) err(`stageOrder 里的 ${k} 没有对应地图定义`);

  /**
   * 场景槽位（`slots`，0-based 章节序号）。
   *
   * 起因（用户需求）：想多几张地图，并且**随机替换 6 章中间的 4 章**。
   * 所以 stageOrder 只是「默认顺序」，每张地图再用 slots 声明它**能出现在第几章**：
   *   · 第 0 章与最后一章是固定的（开场与终章要有固定的调子），只由 desert / night 占；
   *   · 中间那几章，每章从「slots 里包含这一章」的地图里随机抽一张；
   *   · 所以每张地图都必须声明 slots，且中间每一章的候选池不能少于 1 张。
   */
  const slotsOf = (b) => (Array.isArray(b.slots) ? b.slots : []);
  for (const [key, b] of Object.entries(biomes ?? {})) {
    if (b.key !== key) err(`地图 ${key} 的 key 字段（${b.key}）和键名不一致`);
    for (const k of ['name', 'desc', 'sky', 'ground', 'accent']) if (b[k] == null) err(`地图 ${key} 缺字段 ${k}`);
    if (!Array.isArray(b.sky) || b.sky.length !== 3) err(`地图 ${key} 的 sky 必须是 3 个颜色`);
    const slots = slotsOf(b);
    if (!slots.length) err(`地图 ${key} 没有 slots（它要在第几章出现？比如 [1,2]）`);
    for (const s of slots) {
      if (!Number.isInteger(s) || s < 0 || s >= stageOrder.length) err(`地图 ${key} 的 slots 里有非法章节号 ${s}（应在 0~${stageOrder.length - 1}）`);
    }
    for (const s of [0, stageOrder.length - 1]) {
      if (slots.includes(s) && slots.length > 1) err(`地图 ${key} 想占第 ${s + 1} 章，但首章 / 终章必须固定（只留它的 canonical 地图）`);
    }
    if (b.bgm && !keys.includes(b.bgm)) err(`地图 ${key} 的 bgm=${b.bgm} 不是已知地图（想借哪张图的曲子？）`);
    if (b.shape) {
      const s = b.shape;
      if (s.rows != null && (s.rows < 6 || s.rows > 14)) err(`地图 ${key} 的 shape.rows 建议在 6~14 之间（现在 ${s.rows}）`);
      for (const t of Object.keys(s.nodeWeights ?? {})) {
        if (!['battle', 'elite', 'event', 'chest', 'shop', 'rest'].includes(t)) err(`地图 ${key} 的 shape.nodeWeights 里有未知节点类型 ${t}`);
      }
      for (const t of Object.keys(s.guarantee ?? {})) {
        if (!['battle', 'elite', 'event', 'chest', 'shop', 'rest'].includes(t)) err(`地图 ${key} 的 shape.guarantee 里有未知节点类型 ${t}`);
      }
      const total = Object.values(s.nodeWeights ?? {}).reduce((a, v) => a + v, 0);
      if (s.nodeWeights && total <= 0) err(`地图 ${key} 的 shape.nodeWeights 权重全是 0`);
    } else {
      warn(`地图 ${key} 没有 shape 配置（会用地形默认的行数与权重）`);
    }
  }
  // 每一章都要有地图可用（中间几章至少一张候选）
  for (let s = 0; s < stageOrder.length; s += 1) {
    const pool = keys.filter((k) => slotsOf(biomes[k]).includes(s));
    if (!pool.length) err(`第 ${s + 1} 章没有任何地图可用（检查各地图的 slots）`);
  }
  // 每张地图（含只做替补的那些）都要有完整敌人档位，否则那一章会出现「没有精英」
  for (const key of keys) {
    for (const tier of TIERS) {
      const n = enemyList.filter((e) => e.biome === key && e.tier === tier).length;
      if (n === 0) err(`地图 ${key} 没有 ${tier} 档敌人`);
      else if (n === 1 && tier !== 'boss') warn(`地图 ${key} 只有 1 个 ${tier} 敌人，重复度会比较高`);
    }
  }
}

function validateBgm(bgm, biomeKeys, oggMap) {
  const tracks = bgm?.tracks ?? {};
  if (!tracks.title) warn('content/bgm.json 里没有 title 曲目');
  for (const [key, t] of Object.entries(tracks)) {
    // file 是「上游 mp3 的文件名」：fetch-bgm.ps1 拿它在 tools/bgm-ogg-map.json 里
    // 查对应的 ogg(L) 下载地址，落盘成 assets/audio/bgm/<key>.ogg
    if (!t.file || !/\.mp3$/.test(t.file)) err(`BGM ${key} 的 file 必须是上游 mp3 文件名（.mp3 结尾）`);
    else if (oggMap && !oggMap[t.file]) warn(`BGM ${key} 的 ${t.file} 在 tools/bgm-ogg-map.json 里查不到，fetch-bgm.ps1 会重新抓一遍站点（也可能上游改名了）`);
    if (!t.name) warn(`BGM ${key} 没有 name`);
  }
  for (const b of biomeKeys) {
    if (!tracks['map_' + b]) warn(`地图 ${b} 没有专属地图曲（map_${b}）`);
    if (!tracks['battle_' + b]) warn(`地图 ${b} 没有专属战斗曲（battle_${b}）`);
  }
}

/**
 * 商人（商店摊主）：每个地图至少要有一位商人出摊，否则进商店会没有脸也没有货。
 * 商场里的字段直接决定库存与价格，写错范围会让商店失衡，所以这里卡得比较死。
 */
function validateMerchants(merchants, speciesSlugs, biomeKeys, itemIds) {
  const list = merchants?.merchants ?? [];
  if (!Array.isArray(list) || list.length === 0) return err('content/merchants.json 里没有 merchants 数组');
  const ids = new Set();
  const perBiome = new Map(biomeKeys.map((b) => [b, 0]));
  // 小写键，和 src/core/portraits.js 的 EMOTION 表一一对应（那边负责映射到具体文件名）
  const emotions = new Set(['normal', 'happy', 'joyous', 'inspired', 'determined', 'angry', 'sad', 'pain', 'worried',
    'surprised', 'shouting', 'stunned', 'dizzy', 'sigh', 'crying', 'teary']);
  for (const m of list) {
    const at = `商人「${m.id ?? m.name ?? '?'}」`;
    if (!m.id) err(`${at} 缺 id`);
    else if (ids.has(m.id)) err(`商人 id 重复：${m.id}`);
    else ids.add(m.id);
    for (const k of ['name', 'role', 'greet', 'slug', 'leave']) if (!m[k]) err(`${at} 缺 ${k}`);
    if (m.slug && !speciesSlugs.has(m.slug)) err(`${at} 的 slug=${m.slug} 不在 species.json 里（商店要拿它当脸图）`);
    if (m.emotion && !emotions.has(m.emotion)) err(`${at} 的 emotion=${m.emotion} 不是表情键（见 src/core/portraits.js 的 EMOTION，小写，如 happy/determined）`);
    if (!Array.isArray(m.biomes) || !m.biomes.length) err(`${at} 没有 biomes（他要在哪些地图出摊？）`);
    else for (const b of m.biomes) {
      if (!biomeKeys.includes(b)) err(`${at} 的 biome=${b} 不存在`);
      else perBiome.set(b, (perBiome.get(b) ?? 0) + 1);
    }
    // 库存/价格范围：写歪了会直接变成「白送」或「买不起」，所以卡住
    if (!(m.priceMul >= 0.5 && m.priceMul <= 2)) err(`${at} 的 priceMul=${m.priceMul} 应在 0.5~2 之间`);
    if (!(Number.isInteger(m.cards) && m.cards >= 1 && m.cards <= 8)) err(`${at} 的 cards=${m.cards} 应是 1~8 的整数`);
    if (!(Number.isInteger(m.items) && m.items >= 0 && m.items <= 6)) err(`${at} 的 items=${m.items} 应是 0~6 的整数`);
    if (!(m.rarityBoost >= 0 && m.rarityBoost <= 1)) err(`${at} 的 rarityBoost=${m.rarityBoost} 应在 0~1 之间`);
    for (const id of m.mustItems ?? []) if (!itemIds.includes(id)) err(`${at} 的 mustItems 里有不存在的道具 id：${id}`);
    if ((m.mustItems?.length ?? 0) > m.items) err(`${at} 的 mustItems 比 items 还多（${m.mustItems.length} > ${m.items}）`);
    if (m.service && m.service !== 'remove') err(`${at} 的 service=${m.service} 只支持 "remove" 或 null`);
    if (m.service === 'remove' && !(m.servicePrice > 0)) err(`${at} 提供了移除服务但没有 servicePrice`);
  }
  for (const [b, n] of perBiome) {
    if (n === 0) err(`地图 ${b} 一个商人都没有（进商店会空场）`);
    else if (n < 2) warn(`地图 ${b} 只有 1 位商人（${list.filter((m) => m.biomes.includes(b)).map((m) => m.name).join('')}），每次进商店都是同一张脸`);
  }
}

function validateEvents(events, cardIds, itemIds, biomeKeys, specials) {
  const cards = new Set(cardIds);
  const items = new Set(itemIds);
  const ids = new Set();
  for (const ev of events) {
    const at = `${ev._file} 的事件「${ev.id ?? '?'}」`;
    if (!ev.id || !ev.name || !ev.text) err(`${at} 缺 id/name/text`);
    if (ev.biome && !biomeKeys.includes(ev.biome)) err(`${at} 的 biome=${ev.biome} 不存在`);
    if (!Array.isArray(ev.options) || ev.options.length < 2) err(`${at} 至少要 2 个选项`);
    if (ids.has(ev.id)) err(`事件 id 重复：${ev.id}`);
    ids.add(ev.id);

    for (const opt of ev.options ?? []) {
      if (!opt.label) err(`${at} 有选项缺 label`);
      if (!opt.text && !(opt.effects ?? []).some((e) => e.branch)) {
        warn(`${at} 的选项「${opt.label}」没有 text（也没有随机分支文案）`);
      }
      const vars = new Set();
      checkEffects(opt.effects, `${at} / 选项「${opt.label}」`, { cards, items, specials, vars });
      checkText(opt.text, vars, `${at} / 选项「${opt.label}」`, specials);
      for (const b of opt.effects ?? []) {
        if (b.branch) {
          for (const br of b.branch) checkText(br.text, vars, `${at} / 分支`, specials);
        }
        if (b.if) {
          checkText(b.then?.text, vars, `${at} / 条件分支`, specials);
          checkText(b.else?.text, vars, `${at} / 条件分支`, specials);
        }
      }
    }
  }
  return ids;
}

function checkEffects(list, at, ctx) {
  if (!list) return;
  if (!Array.isArray(list)) { err(`${at} 的 effects 必须是数组`); return; }
  const keys = ['hp', 'hpPct', 'fullHeal', 'stat', 'gold', 'goldRange', 'item', 'card', 'cardRandom', 'cardRarity', 'removeCard', 'branch', 'if', 'special'];
  for (const eff of list) {
    if (!eff || typeof eff !== 'object') { err(`${at} 里有个效果不是对象`); continue; }
    const own = Object.keys(eff);
    if (own.length !== 1 && !eff.if) { err(`${at} 的效果只能有一个键：${JSON.stringify(eff)}`); continue; }
    const key = own[0];
    if (!keys.includes(key)) { err(`${at} 用了未知效果 ${key}`); continue; }
    if (key === 'card' && !ctx.cards.has(eff.card)) err(`${at} 给了不存在的卡牌 ${eff.card}`);
    if (key === 'removeCard' && !ctx.cards.has(eff.removeCard)) err(`${at} 去掉了不存在的卡牌 ${eff.removeCard}`);
    if (key === 'item') {
      const id = typeof eff.item === 'string' ? eff.item : eff.item?.id;
      if (!ctx.items.has(id)) err(`${at} 给了不存在的道具 ${id}`);
    }
    if (key === 'cardRarity') {
      for (const r of eff.cardRarity?.rarities ?? []) if (!RARITIES.includes(r)) err(`${at} 的稀有度 ${r} 不存在`);
    }
    if (key === 'stat') {
      for (const k of Object.keys(eff.stat ?? {})) {
        if (!['atk', 'def', 'agi', 'luck', 'maxHp'].includes(k)) err(`${at} 想加不存在的属性 ${k}`);
      }
    }
    if (key === 'branch') {
      for (const br of eff.branch ?? []) checkEffects(br.effects, at, ctx);
    }
    if (key === 'if') {
      checkEffects(eff.then?.effects, at, ctx);
      checkEffects(eff.else?.effects, at, ctx);
    }
    if (key === 'special' && !ctx.specials.has(eff.special)) err(`${at} 调了没注册的 special: ${eff.special}`);
    for (const v of varsOfEffectStatic(eff)) ctx.vars.add(v);
  }
}

/** 和 src/core/eventfx.js 的 varsProduced 保持一致的静态版本 */function varsOfEffectStatic(eff) {
  const out = new Set();
  const key = Object.keys(eff)[0];
  const map = {
    hp: Number(eff.hp) >= 0 ? ['heal'] : ['hp'],
    hpPct: Number(eff.hpPct) >= 0 ? ['heal'] : ['hp'],
    fullHeal: ['heal'],
    stat: Object.keys(eff.stat ?? {}),
    gold: ['gold'],
    goldRange: ['gold'],
    item: ['item', 'n'],
    card: ['card'],
    cardRandom: ['card'],
    cardRarity: ['card'],
    removeCard: ['removed'],
    branch: [],
    if: [],
    special: ['*'],
  };
  for (const v of map[key] ?? []) out.add(v);
  return out;
}

function checkText(text, vars, at, specials) {
  if (!text) return;
  for (const m of String(text).matchAll(/\{(\w+)\}/g)) {
    const token = m[1];
    if (vars.has('*')) continue;         // 有 special 就放过（它能产出任意变量）
    if (!vars.has(token)) warn(`${at} 的文案用了 {${token}}，但这组效果里没有产出这个值`);
  }
}

// ============================================================
// 生成
// ============================================================

/** 把 name 区块的内容替换掉（syntax='css' 时用 CSS 注释标记，默认用 JS 注释标记） */
async function writeBlock(relPath, name, body, syntax = 'js') {
  const p = path.join(ROOT, relPath);
  const src = await fs.readFile(p, 'utf8');
  const start = syntax === 'css' ? `/* #region GENERATED-${name} */` : `// #region GENERATED-${name}`;
  const end = syntax === 'css' ? `/* #endregion GENERATED-${name} */` : `// #endregion GENERATED-${name}`;
  const si = src.indexOf(start);
  const ei = src.indexOf(end);
  if (si < 0 || ei < 0) {
    err(`${relPath} 里找不到 ${name} 的生成区块标记（${start}）`);
    return;
  }
  const next = src.slice(0, si + start.length) + '\n' + body.trimEnd() + '\n' + src.slice(ei);
  if (next !== src) await fs.writeFile(p, next, 'utf8');
  return next !== src;
}

const J = (v) => JSON.stringify(v, null, 2);

function emitCards(cards, items, starterDeck, starterItems) {
  const art = Object.fromEntries(cards.map((c) => [c.id, { ico: c.ico, fx: c.fx }]));
  const bare = cards.map((c) => {
    const { ico, fx, ...rest } = c;
    return rest;
  });
  return [
    'export const CARDS = ' + J(bare) + ';',
    '',
    'export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));',
    '',
    '/** 卡面美术：图标 mask 类名 + 背景特效图（写在 content/cards.json 的 ico / fx 字段里） */',
    'export const CARD_ART = ' + J(art) + ';',
    '',
    'export const STARTER_DECK = ' + J(starterDeck) + ';',
    '',
    'export const STARTER_ITEMS = ' + J(starterItems) + ';',
    '',
    'export const ITEMS = ' + J(items) + ';',
  ].join('\n');
}

function emitEnemies(tiers, movePools, enemies, species) {
  const list = enemies.map((e) => {
    // 物种信息（名称 / 图鉴号 / 属性）统一从 species.json 取，敌人条目里不再重复写一遍，
    // 也避免「加了敌人忘了写 types」这种缺失（战斗界面的属性行会直接崩）
    const sp = species[e.slug] ?? {};
    const lines = [];
    lines.push('  {');
    lines.push(`    "id": ${JSON.stringify(e.id)},`);
    lines.push(`    "slug": ${JSON.stringify(e.slug)},`);
    lines.push(`    "name": ${JSON.stringify(sp.name ?? e.slug)},`);
    lines.push(`    "en": ${JSON.stringify(sp.en ?? '')},`);
    lines.push(`    "dex": ${JSON.stringify(String(sp.dex ?? ''))},`);
    lines.push(`    "types": ${J(sp.types ?? [])},`);
    lines.push(`    "tier": ${JSON.stringify(e.tier)},`);
    lines.push(`    "biome": ${JSON.stringify(e.biome)},`);
    lines.push(`    "deck": ${typeof e.deck === 'string' ? `MOVE_POOLS.${e.deck}` : J(e.deck).replace(/\n\s*/g, ' ')},`);
    // 专属招式：一定会进这副牌组（见 game.js 的 buildEnemyDeck），
    // 所以首领的招牌招不会被随机抽牌漏掉
    if (e.signature?.length) lines.push(`    "signature": ${J(e.signature).replace(/\n\s*/g, ' ')},`);
    lines.push(`    "lines": ${J(e.lines).replace(/\n\s*/g, ' ')},`);
    if (e.bossTitle) lines.push(`    "bossTitle": ${JSON.stringify(e.bossTitle)},`);
    if (e.final) lines.push('    "final": true,');
    lines.push('  }');
    return lines.join('\n');
  });
  return [
    'export const TIERS = ' + J(tiers) + ';',
    '',
    'export const MOVE_POOLS = ' + J(movePools) + ';',
    '',
    'export const ENEMIES = [',
    list.join(',\n'),
    '];',
    '',
    'export const ENEMY_BY_ID = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));',
  ].join('\n');
}

function emitBiomes(stageOrder, biomes, rarity) {
  // `rewardWeights`（打完怪按档位给什么稀有度）单独导出一个常量 ——
  // 混在 RARITY 里会让「遍历稀有度」的代码把它当成一档稀有度
  // （check-content.mjs 就是 `Object.keys(RARITY)` 那样遍历的）。
  const { rewardWeights, ...rarityOnly } = rarity;
  // 每张地图能出现在第几章（0-based）：中间那 4 章随机抽，首尾固定。
  const slots = {};
  // 借曲子：新地图不额外抓音频，直接借一张已有的（bgmKeyFor 会去找 bgm_<key>）
  const bgm = {};
  for (const [key, b] of Object.entries(biomes ?? {})) {
    slots[key] = b.slots ?? [];
    if (b.bgm) bgm[key] = b.bgm;
  }
  return [
    'export const STAGE_BIOME = ' + J(stageOrder) + ';',
    '',
    'export const BIOMES = ' + J(biomes) + ';',
    '',
    '/** 每张地图能出现在第几章（0-based）。中间几章从这里随机抽，首章 / 终章固定 —— 见 game.newRun() */',
    'export const BIOME_SLOTS = ' + J(slots) + ';',
    '',
    '/** 新地图借用的 BGM（没写就用通用曲） */',
    'export const BIOME_BGM = ' + J(bgm) + ';',
    '',
    'export const RARITY = ' + J(rarityOnly) + ';',
    '',
    '/** 战斗奖励的稀有度权重，按敌人档位分（普通怪 / 精英 / 首领）—— 见 content/rarity.json */',
    'export const REWARD_WEIGHTS = ' + J(rewardWeights ?? {}) + ';',
  ].join('\n');
}

function emitBgm(bgm) {
  const files = {};
  const names = {};
  for (const [key, t] of Object.entries(bgm.tracks)) {
    // ogg(L) 版落在 assets/audio/bgm/<key>.ogg（fetch-bgm.ps1 就是这么命名的），
    // 名字统一成 <key>.ogg：上游压缩包里的文件名是日文标题，不能直接拿来当路径
    files[key] = `${key}.ogg`;
    names[key] = t.desc ? `${t.desc} · ${t.name}` : t.name;
  }
  return [
    'export const BGM_FILES = ' + J(files) + ';',
    '',
    'export const BGM_NAMES = ' + J(names) + ';',
  ].join('\n');
}

/**
 * 生成 style.css 的 GENERATED-ICONS 区块：每个图标一条 `.ico-<name>` mask 规则。
 *
 * 为什么是 mask 而不是 <img>（t1 报告的结论）：Game-Icon-Pack 里只有 currentColor 剪影、
 * 没有彩色素材；而 bundle.mjs 只内联 CSS 里的 `url(assets/...)`，`<img src="assets/...">`
 * 在 file:// 下会被当跨源请求拦掉。走 mask 的话 bundle.mjs 一行都不用改。
 */
function emitIcons(icons) {
  const lines = [
    '/* 这一段由 content/icons.json 生成 —— 不要手写，改注册表后跑 node tools/build-content.mjs */',
    '/* 加图标：content/icons.json 加一条 -> & tools/fetch-iconpack.ps1 -> node tools/build-content.mjs */',
  ];
  const groups = [...new Set(icons.map((i) => i.group))];
  for (const g of groups) {
    lines.push('');
    lines.push(`/* --- ${g} --- */`);
    for (const i of icons.filter((x) => x.group === g)) {
      // 每条规则压成一行：单文件包会把这段 CSS 原样内联，多行写法白占几 KB
      lines.push(`.ico-${i.name} { /* ${i.desc} */ -webkit-mask-image: url(${i.url}); mask-image: url(${i.url}); }`);
    }
  }
  return lines.join('\n');
}

function emitMerchants(merchants) {
  // 一条一行：好看 diff，也方便以后手工扫一遍「这个商人卖得贵不贵」
  const rows = (merchants.merchants ?? []).map((m) => '  ' + JSON.stringify(m));
  return ['export const MERCHANTS = [', rows.join(',\n'), '];'].join('\n');
}

function emitEvents(events) {  const list = events.map((ev) => {
    const head = { id: ev.id, name: ev.name };
    if (ev.biome) head.biome = ev.biome;
    head.text = ev.text;
    if (ev.once === false) head.once = false;
    const headLines = Object.entries(head).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
    const opts = ev.options.map((o) => '      eventOption(' + J(o).split('\n').map((l, i) => (i === 0 ? l : '      ' + l)).join('\n') + ')');
    return '  {\n' + headLines + ',\n    "options": [\n' + opts.join(',\n') + ',\n    ]\n  }';
  });
  return [
    'export const EVENTS = [',
    list.join(',\n'),
    '];',
    '',
    'export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));',
  ].join('\n');
}

// ============================================================
// main
// ============================================================

const data = await loadAll();
const { specials } = await import('../src/core/eventfx.js');

// --check：只校验、不写文件（多人/多 agent 并行改内容时用它，避免半成品被生成进源码）
const CHECK_ONLY = process.argv.includes('--check');

// 图标：component_name -> 分类目录（来自 tools/icon-catalog.json）+ t1 选型草表里的 component 全集
const iconCategory = new Map((Array.isArray(data.iconCatalog) ? data.iconCatalog : [])
  .filter((i) => i?.component_name && i?.category)
  .map((i) => [i.component_name, i.category]));
for (const t of data.iconDraft?.table ?? []) {
  for (const c of t.candidates ?? []) {
    if (c?.component_name) iconCategory.set(c.component_name, c.category);
  }
}
const icons = await resolveIcons(data.icons, iconCategory);
const iconNameSet = new Set(icons.map((i) => i.name));

const cardIds = validateCards(data.cards, iconNameSet);
validateSpecies(data.species, data.enemies.enemies);
validateEnemies(data.enemies, cardIds, Object.keys(data.biomes.biomes));
validateBiomes(data.biomes, data.enemies.enemies);
validateBgm(data.bgm, data.biomes.stageOrder, data.oggMap);
validateMerchants(data.merchants, new Set(Object.keys(data.species.species)), Object.keys(data.biomes.biomes), Object.keys(data.cards.items));
validateEvents(data.events, cardIds, Object.keys(data.cards.items), Object.keys(data.biomes.biomes), new Set(Object.keys(specials ?? {})));

if (errors.length) {
  console.error('\n内容校验没通过：');
  for (const e of errors) console.error('  ✗ ' + e);
  console.error(`\n共 ${errors.length} 个错误，已终止（没有改动源码）。`);
  process.exit(1);
}

const changed = [];
if (!CHECK_ONLY) {
  if (await writeBlock('src/data/cards.js', 'CARDS', emitCards(data.cards.cards, data.cards.items, data.cards.starterDeck, data.cards.starterItems))) changed.push('src/data/cards.js');
  if (await writeBlock('src/data/enemies.js', 'ENEMIES', emitEnemies(data.enemies.tiers, data.enemies.movePools, data.enemies.enemies, data.species.species))) changed.push('src/data/enemies.js');
  if (await writeBlock('src/data/balance.js', 'BIOMES', emitBiomes(data.biomes.stageOrder, data.biomes.biomes, await readJson(path.join(CONTENT, 'rarity.json'))))) changed.push('src/data/balance.js');
  if (await writeBlock('src/data/events.js', 'EVENTS', emitEvents(data.events))) changed.push('src/data/events.js');
  if (await writeBlock('src/data/merchants.js', 'MERCHANTS', emitMerchants(data.merchants))) changed.push('src/data/merchants.js');
  if (await writeBlock('src/core/bgm.js', 'BGM', emitBgm(data.bgm))) changed.push('src/core/bgm.js');
  if (await writeBlock('src/ui/style.css', 'ICONS', emitIcons(icons), 'css')) changed.push('src/ui/style.css');

  // 物种表也生成一份给素材脚本用（PowerShell 直接读 JSON）
  await fs.writeFile(path.join(ROOT, 'assets', 'data', 'species.json'), JSON.stringify(data.species, null, 2) + '\n', 'utf8');
}

console.log(CHECK_ONLY ? '内容校验通过（--check：没有写文件）：' : '内容管线跑完：');
console.log(`  卡牌 ${data.cards.cards.length} 张 · 招式池 ${Object.keys(data.enemies.movePools).length} 个 · 敌人 ${data.enemies.enemies.length} 个`);
console.log(`  地图 ${Object.keys(data.biomes.biomes).length} 张（${data.biomes.stageOrder.join(' → ')}）· 事件 ${data.events.length} 个 · 物种 ${Object.keys(data.species.species).length} 个`);
console.log(`  BGM ${Object.keys(data.bgm.tracks).length} 首 · 商人 ${(data.merchants.merchants ?? []).length} 位`);
const packIcons = icons.filter((i) => i.source.startsWith('pack:')).length;
console.log(`  图标 ${icons.length} 个（Game-Icon-Pack ${packIcons} 个 + 本地 Kenney 素材 ${icons.length - packIcons} 个）`);
console.log('  生成区块：' + (CHECK_ONLY ? '（--check 未写入）' : changed.length ? changed.join('、') : '无变化'));
if (warnings.length) {
  console.log(`\n提醒 ${warnings.length} 条（不影响生成）：`);
  for (const w of warnings.slice(0, 40)) console.log('  · ' + w);
  if (warnings.length > 40) console.log(`  …还有 ${warnings.length - 40} 条`);
}
