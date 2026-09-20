// 把「敌方名单设计表」（content/_enemy-plan.json）落到内容数据上。
//
// 分为两步，可以分开跑：
//   node tools/apply-enemy-plan.mjs species     # 只把设计表里还没有的物种补进 content/species.json
//   node tools/apply-enemy-plan.mjs enemies     # 按设计表重写 content/enemies.json（见下面 TODO）
//   node tools/apply-enemy-plan.mjs check       # 只校验设计表（位置数 / 唯一性 / 池子大小 / 世代）
//
// 为什么要有它：这份名单是**按主题 + 世代挑的**（用户要求：「不能有重复出现的敌方宝可梦」
// 「为什么怪力会出现在墓地？有任何关系吗？」「不要全部选第一世代的，后面也要选」），
// 手改 170 条 JSON 既容易漏也说不清改动，用脚本从设计表生成才能对账。
//
// 物种名一律来自 tools/_new-species.json（PokeAPI 的英文 / 日文 + 52poke 的官方中文名），
// 见 tools/fetch-species-names.mjs —— **不许手写**，我凭印象猜过两个：Nacli 以为是「晶光芽」
// （实际「盐石宝」）、Runerigus 以为是「死神板」（实际「迭失板」）。
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'check';
const TIERS = ['mob', 'normal', 'elite', 'boss'];

const plan = JSON.parse(await fs.readFile(path.join(ROOT, 'content', '_enemy-plan.json'), 'utf8'));
const speciesFile = path.join(ROOT, 'content', 'species.json');
const species = JSON.parse(await fs.readFile(speciesFile, 'utf8'));
const names = JSON.parse(await fs.readFile(path.join(ROOT, 'tools', '_new-species.json'), 'utf8').catch(() => '{}'));

/** 设计表里的全部位置：[{biome, tier, dex}] */
function planSlots() {
  const out = [];
  for (const [biome, b] of Object.entries(plan.biomes)) {
    for (const tier of TIERS) for (const dex of b[tier] ?? []) out.push({ biome, tier, dex: Number(dex) });
  }
  return out;
}

function check() {
  const problems = [];
  const slots = planSlots();
  const byDex = new Map();
  for (const s of slots) byDex.set(s.dex, (byDex.get(s.dex) ?? 0) + 1);
  for (const [dex, n] of byDex) if (n > 1) problems.push(`图鉴号 ${dex} 在名单里出现 ${n} 次`);
  /**
   * 档位数量的要求是**范围**而不是死数：
   * 硬要求只有两条 —— 池子（杂兵+较强）≥12（一章最多 9 场战斗，池子小了必然重复），
   * 以及精英 / 首领够撑起一张图（≥3 / ≥2）。个别图多一两只没关系，
   * 所以事件文案里点名过的物种（熔岩蜗牛、尖牙陆鲨）可以顺手加回去。
   */
  const RANGE = { mob: [6, 10], normal: [4, 6], elite: [3, 5], boss: [2, 3] };
  for (const [biome, b] of Object.entries(plan.biomes)) {
    for (const tier of TIERS) {
      const n = (b[tier] ?? []).length;
      const [lo, hi] = RANGE[tier];
      if (n < lo || n > hi) problems.push(`${biome}/${tier} 有 ${n} 个，应在 ${lo}~${hi} 之间`);
    }
    const pool = (b.mob ?? []).length + (b.normal ?? []).length;
    if (pool < 12) problems.push(`${biome} 的杂兵+较强只有 ${pool} 只（一章最多 9 场战斗，要 ≥12）`);
  }
  const missing = slots.filter((s) => !Object.values(species.species).some((r) => Number(r.dex) === s.dex));
  if (missing.length) problems.push(`有 ${missing.length} 个位置对应的物种还没进 species.json：${missing.map((m) => m.dex).join(' ')}`);

  console.log(`设计表：${slots.length} 个位置 ｜ 涉及物种 ${byDex.size} 个 ｜ 其中已进 species.json 的 ${slots.length - missing.length} 个`);
  for (const [biome, b] of Object.entries(plan.biomes)) {
    console.log(`  ${b.name.padEnd(6)} 杂兵 ${(b.mob ?? []).length} + 较强 ${(b.normal ?? []).length} = ${(b.mob ?? []).length + (b.normal ?? []).length}`
      + ` ｜ 精英 ${(b.elite ?? []).length} ｜ 首领 ${(b.boss ?? []).length}`);
  }
  if (problems.length) {
    console.error(`\n发现 ${problems.length} 个问题：\n  ` + problems.join('\n  '));
    process.exitCode = 1;
  } else {
    console.log('设计表自检通过 ✓');
  }
}

async function applySpecies() {
  const bySlug = { ...species.species };
  let added = 0;
  for (const s of planSlots()) {
    const existing = Object.values(bySlug).find((r) => Number(r.dex) === s.dex);
    if (existing) continue;
    const rec = names[s.dex] ?? names[String(s.dex)];
    if (!rec?.zh) { console.warn(`  跳过 ${s.dex}：tools/_new-species.json 里没有它的名字`); continue; }
    bySlug[rec.slug] = { dex: rec.dex, slug: rec.slug, name: rec.zh, en: rec.en, types: rec.types };
    added += 1;
  }
  const sorted = {};
  for (const [slug, rec] of Object.entries(bySlug).sort((a, b) => Number(a[1].dex) - Number(b[1].dex))) sorted[slug] = rec;
  species.species = sorted;
  await fs.writeFile(speciesFile, `${JSON.stringify(species, null, 2)}\n`, 'utf8');
  console.log(`species.json：新增 ${added} 个物种，现在共 ${Object.keys(sorted).length} 个`);
}

/**
 * 按设计表重写 content/enemies.json。
 *
 * 三条原则：
 *   ① **沿用**：物种本来就在名单里的（不管原来挂在哪张图 / 哪个档位），它的台词、招式包、
 *      首领称号一律照抄 —— 那是有意写的文案，不该被脚本重写掉。
 *   ② **招式包按属性挑**：新物种按「主属性 → 招式包」的对照表挑包（那张表是从现有名单统计出来的：
 *      地面→kit_ground、草→kit_grass…），精英 / 首领再把包升到 `_hi` 变体。
 *      这样各张图的**招式包分布**和改之前基本一致，难度不会因为换物种而跑掉。
 *   ③ **专属招式按位置继承**：每个 (地图, 档位) 原本的专属招式列表按顺序发给这一档的新名单 ——
 *      「这张图的首领一定带哪张招牌牌」这件事不变（平衡不动）。
 *
 * 新物种的台词 / 首领称号写在 content/_enemy-lines.json（`{ "<slug>": { lines: [...], bossTitle } }`）。
 * 生成器把它合进来之后，那条就「存在」了，下次再跑会照抄 —— 所以那个文件只是**新文案的输入**，
 * 正文以 content/enemies.json 为准。
 */
async function applyEnemies() {
  const enemiesFile = path.join(ROOT, 'content', 'enemies.json');
  const data = JSON.parse(await fs.readFile(enemiesFile, 'utf8'));
  const authored = JSON.parse(await fs.readFile(path.join(ROOT, 'content', '_enemy-lines.json'), 'utf8').catch(() => '{}'));
  const pools = data.movePools;
  const slugByDex = new Map();
  for (const [slug, r] of Object.entries(species.species)) slugByDex.set(Number(r.dex), slug);
  const old = data.enemies;
  const oldBySlug = new Map();
  for (const e of old) if (!oldBySlug.has(e.slug)) oldBySlug.set(e.slug, e);
  /**
   * 「同一只宝可梦在旧名单里占多条」时，**优先取档位对得上的那一条**。
   * 以前只按 slug 取第一条，于是「化石翼龙」这条首领继承了它当精英时的那份数据 ——
   * 称号没了（首领没有 bossTitle，build-content 直接提醒），台词也是精英那两句。
   */
  const oldBySlugTier = new Map();
  for (const e of old) if (!oldBySlugTier.has(`${e.slug}|${e.tier}`)) oldBySlugTier.set(`${e.slug}|${e.tier}`, e);
  const pickOld = (slug, tier) => oldBySlugTier.get(`${slug}|${tier}`) ?? oldBySlug.get(slug);

  /** 主属性 → 招式包（从现有名单统计；同一属性有多个包时取用得最多的那个）—— 只作兜底用 */
  const typeKit = new Map();
  {
    const tally = new Map();
    for (const e of old) {
      const type = species.species[e.slug]?.types?.[0];
      if (!type) continue;
      if (!tally.has(type)) tally.set(type, new Map());
      const m = tally.get(type);
      m.set(e.deck, (m.get(e.deck) ?? 0) + 1);
    }
    for (const [type, m] of tally) {
      const best = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      if (best) typeKit.set(type, best[0]);
    }
  }
  /** 每张图原本用过的招式包：新物种优先落在这里面，免得把某张图的风格带跑 */
  const biomeKits = new Map();
  for (const e of old) {
    if (!biomeKits.has(e.biome)) biomeKits.set(e.biome, new Map());
    const m = biomeKits.get(e.biome);
    m.set(e.deck, (m.get(e.deck) ?? 0) + 1);
  }
  const asHi = (kit) => (pools[`${kit}_hi`] ? `${kit}_hi` : kit);
  /**
   * 招式包名里的「属性词」↔ 物种属性。
   * 精英 / 首领这一档人少、又是有名有姓的遭遇，所以给新物种挑包时**先看合不合身**
   * （幽灵首领拿 kit_ghost_hi、龙首领拿 kit_dragon_hi），合不上再按位置顺延。
   * 杂兵 / 较强不动——那一档人多，位置顺序更能保住各图的招式包构成。
   */
  const KIT_TYPE = {
    ghost: '幽灵', steel: '钢', dragon: '龙', grass: '草', fire: '火', water: '水', bug: '虫',
    electric: '电', rock: '岩石', ground: '地面', poison: '毒', flying: '飞行', fighting: '格斗',
    debuff: '恶', weaken: '恶', crystal: '冰', ruins: '超能',
  };

  const next = [];
  const needLines = [];
  const needTitles = [];
  for (const [biome, b] of Object.entries(plan.biomes)) {
    for (const tier of TIERS) {
      const oldHere = old.filter((e) => e.biome === biome && e.tier === tier);
      const sigs = oldHere.map((e) => e.signature ?? []).filter((s) => s.length);
      /**
       * 招式包**按位置继承**，不按属性硬挑。
       *
       * 这是改过一次的：第一版按「主属性 → 招式包」给新物种挑包，结果森林那张图的两个首领
       * 都落到了 `kit_grass_hi`，而改之前是 `kit_grass_hi` + `kit_bug_hi` ——
       * 招式包一变，难度就跟着变：实测第 3 章首领胜率从基线 ~57% 掉到 **36.7%**。
       * 现在的规则是：每个 (地图, 档位) 原本的招式包列表**原样按顺序发给**这一档的新名单，
       * 于是每张图各档的招式包构成和改之前完全一致 —— 换的只是「谁站在那里」，不是「它有多强」。
       */
      const oldKits = oldHere.map((e) => e.deck);
      const usedKits = new Set();
      let sigIdx = 0;
      (b[tier] ?? []).forEach((dex, i) => {
        const slug = slugByDex.get(Number(dex));
        if (!slug) { console.warn(`  ✗ ${biome}/${tier} 的 ${dex} 在 species.json 里找不到`); return; }
        const sp = species.species[slug];
        const elite = tier === 'elite' || tier === 'boss';
        const kept = pickOld(slug, tier);
        /**
         * 招式包怎么定：
         *   · **原本就在名单里的物种**（kept）用**它自己的包**（档位变了才升降 `_hi`）——
         *     那些是手调过的遭遇（尤其是结局首领基格尔德），不该被脚本按位置改掉；
         *   · **新物种**继承**它顶替的那个位置**原本的包 —— 这样每张图各档的招式包构成
         *     和改之前基本一致，难度不会因为换物种而跑掉。
         *     （第一版是按「主属性 → 招式包」硬挑的，结果森林两个首领都落到了 kit_grass_hi，
         *      实测第 3 章首领胜率从 ~57% 掉到 36.7% —— 招式包就是难度。）
         *   · 精英 / 首领再补一条「合不合身」的偏好：幽灵首领优先拿 kit_ghost_hi。
         */
        let kit;
        /** 设计表可以**钉死**某一档的招式包顺序（`bossKit` / `eliteKit`）：少数几只（例如达克莱伊）
         *  按属性自动挑会挑歪 —— 它是纯「恶」属性，撞不上 kit_ghost，于是幽灵包落到了别人头上。 */
        const pinned = plan.biomes[biome][`${tier}Kit`];
        if (pinned?.[i]) kit = pinned[i].replace(/_hi$/, '');
        else if (kept) {
          kit = kept.deck.replace(/_hi$/, '');
          // 保住手的遭遇会占掉它原本那个包：新物种只能从**剩下**的包里挑，
          // 这样每张图各档的招式包构成和改之前一模一样（只是换了穿这身衣服的是谁）
          usedKits.add(kept.deck.replace(/_hi$/, ''));
        } else if (elite && oldKits.length) {
          const free = oldKits.map((k) => k.replace(/_hi$/, '')).filter((k) => !usedKits.has(k));
          // 先挑「合身」的（幽灵首领拿 kit_ghost），没有合身的就顺延，实在没有了才按位置重复
          const fit = free.find((k) => (sp.types ?? []).includes(KIT_TYPE[k.replace(/^kit_/, '')] ?? '\u0000'));
          kit = fit ?? free[0] ?? oldKits[i % oldKits.length].replace(/_hi$/, '');
          usedKits.add(kit);
        } else kit = (oldKits.length ? oldKits[i % oldKits.length] : (typeKit.get(sp.types?.[0]) ?? typeKit.get(sp.types?.[1]) ?? 'kit_normal')).replace(/_hi$/, '');
        if (elite) kit = asHi(kit);
        if (kept) {
          const entry = { ...kept, id: slug, slug, tier, biome, deck: kit };
          if (elite) {
            const sig = sigs[sigIdx % Math.max(1, sigs.length)] ?? kept.signature;
            sigIdx += 1;
            if (sig?.length) entry.signature = sig; else delete entry.signature;
          } else {
            delete entry.signature;
          }
          next.push(entry);
          return;
        }
        const mine = authored[slug] ?? {};
        const entry = { id: slug, slug, tier, biome, deck: kit, lines: mine.lines ?? ['（台词待写）'] };
        if (elite) {
          const sig = sigs[sigIdx % Math.max(1, sigs.length)] ?? [];
          sigIdx += 1;
          if (sig.length) entry.signature = sig;
          if (tier === 'boss') entry.bossTitle = mine.bossTitle ?? '（称号待写）';
        }
        if (Number(dex) === 718) entry.final = true;
        if (!mine.lines) needLines.push(`${slug}（${sp.name}｜${b.name}｜${tier}）`);
        if (tier === 'boss' && !mine.bossTitle) needTitles.push(`${slug}（${sp.name}｜${b.name}）`);
        next.push(entry);
      });
    }
  }

  data.enemies = next;
  await fs.writeFile(enemiesFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  const freshCount = next.filter((e) => !oldBySlug.has(e.slug)).length;
  console.log(`enemies.json：${old.length} → ${next.length} 条（其中新物种 ${freshCount} 条）`);
  const dup = next.length - new Set(next.map((e) => e.slug)).size;
  console.log(dup ? `  ⚠ 还有 ${dup} 条是同一个物种占多条` : '  ✓ 每个物种只占一条');
  if (needLines.length) {
    console.log(`\n还要写台词的 ${needLines.length} 条（写进 content/_enemy-lines.json 的 <slug>.lines）：`);
    for (const l of needLines) console.log('  - ' + l);
  }
  if (needTitles.length) {
    console.log(`\n还要写首领称号的 ${needTitles.length} 条（同文件，键名 bossTitle）：`);
    for (const l of needTitles) console.log('  - ' + l);
  }
}

if (mode === 'species') await applySpecies();
else if (mode === 'enemies') await applyEnemies();
else if (mode === 'check') check();
else {
  console.error(`不认识的方式：${mode}（可用：species / enemies / check）`);
  process.exitCode = 1;
}
