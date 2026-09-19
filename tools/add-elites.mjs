// 给每张地图补强敌（精英）。
//
// 起因（用户反馈）：「现在所有强敌个数很少，你可以多设一些吗？我感觉重复率很大。」
// 原来全游戏只有 12 只精英，流沙之海更是**只有 1 只**（大钢蛇）——
// 那一章每次打精英都是同一只，check-content 一直在警告「地图 desert 只有 1 个 elite 敌人」。
// 这一批每张地图补 2 只，精英总数 12 → 24。
//
// 顺带给其中几只写**专属招式**（写在 signature 里，game.js 的 buildEnemyDeck 保证它一定进牌组）。
//
// 用法: node tools/add-elites.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const enemiesFile = path.join(root, 'content', 'enemies.json');
const cardsFile = path.join(root, 'content', 'cards.json');
const WRITE = process.argv.includes('--write');

const enemiesData = JSON.parse(fs.readFileSync(enemiesFile, 'utf8'));
const cardsData = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));

// ---------------- 一、专属招式 ----------------
/** 简写：写一张敌人专用卡 */
const SIG = (id, name, ap, rarity, ico, fx, text, effects) =>
  ({ id, name, ap, rarity, targeting: 'enemy', ico, fx, text, effects, enemyOnly: true });

const SIGNATURES = {
  // 流沙之海
  hippowdon: SIG('sig_sand_pit', '流沙陷坑', 2, 'uncommon', 'ico-earthquake', 'dirt_2',
    '造成 {d} 点伤害，并让对手敏捷 -3。',
    [{ kind: 'damage', power: 230 }, { kind: 'buff', stat: 'agi', amount: -3, target: 'enemy' }]),
  claydol: SIG('sig_ancient_beam', '古代射线', 2, 'uncommon', 'ico-demon_02', 'magic_2',
    '造成 {d} 点伤害，并让对手防御 -30%。',
    [{ kind: 'damage', power: 220 }, { kind: 'buff', stat: 'def', pct: -0.3, target: 'enemy' }]),
  // 赤岩峡谷
  camerupt: SIG('sig_magma_erupt', '熔岩喷发', 3, 'rare', 'ico-volcanic_eruption', 'flare_1',
    '连续 2 次造成 {d} 点伤害，并给对手 2 层灼伤。',
    [{ kind: 'damage', power: 140, hits: 2 }, { kind: 'status', status: 'burn', stacks: 2 }]),
  torkoal: SIG('sig_white_smoke', '白烟', 2, 'uncommon', 'ico-fog', 'smoke_1',
    '获得护盾（随防御成长），并给对手 2 层灼伤。',
    [{ kind: 'shield', amount: 12, scaleWithDef: true }, { kind: 'status', status: 'burn', stacks: 2 }]),
  // 藤蔓密林
  scizor: SIG('sig_bullet_slash', '子弹斩', 2, 'rare', 'ico-sword', 'slash_1',
    '连续 3 次造成 {d} 点伤害。本场战斗攻击 +3。',
    [{ kind: 'damage', power: 90, hits: 3 }, { kind: 'buff', stat: 'atk', amount: 3 }]),
  scolipede: SIG('sig_megahorn_charge', '巨角突击', 2, 'uncommon', 'ico-spear', 'spark_06',
    '造成 {d} 点伤害，并给对手 2 层中毒和 1 层虚弱。',
    [{ kind: 'damage', power: 230 }, { kind: 'status', status: 'poison', stacks: 2 }, { kind: 'status', status: 'weak', stacks: 1 }]),
  // 潮汐盐海
  kingdra: SIG('sig_dragon_water', '龙水炮', 3, 'rare', 'ico-water', 'magic_1',
    '造成 {d} 点伤害，并给对手 2 层剧毒。',
    [{ kind: 'damage', power: 300 }, { kind: 'status', status: 'toxic', stacks: 2 }]),
  mantine: SIG('sig_tide_ride', '乘浪滑翔', 1, 'uncommon', 'ico-wind', 'twirl_02',
    '获得护盾（随防御成长），抽 1 张。',
    [{ kind: 'shield', amount: 14, scaleWithDef: true }, { kind: 'draw', n: 1 }]),
  // 风蚀峭壁
  braviary: SIG('sig_brave_bird', '勇鸟猛攻', 3, 'rare', 'ico-bow', 'slash_1',
    '造成 {d} 点伤害，自身也受到一部分反冲。',
    [{ kind: 'damage', power: 330, recoilPct: 0.2 }]),
  archeops: SIG('sig_rock_slide_wing', '岩翼俯冲', 2, 'uncommon', 'ico-stone', 'spark_02',
    '造成 {d} 点伤害，并让对手防御 -4。',
    [{ kind: 'damage', power: 240 }, { kind: 'buff', stat: 'def', amount: -4, target: 'enemy' }]),
  // 夜砂墓原
  chandelure: SIG('sig_soul_flame', '魂之火', 2, 'rare', 'ico-flame', 'magic_2',
    '造成 {d} 点伤害，并给对手 2 层灼伤和 1 层剧毒。',
    [{ kind: 'damage', power: 240 }, { kind: 'status', status: 'burn', stacks: 2 }, { kind: 'status', status: 'toxic', stacks: 1 }]),
  cofagrigus: SIG('sig_curse_mummy', '诅咒棺', 2, 'uncommon', 'ico-gravestone', 'magic_1',
    '给对手 3 层中毒，并让对手攻击 -35%。',
    [{ kind: 'status', status: 'poison', stacks: 3 }, { kind: 'buff', stat: 'atk', pct: -0.35, target: 'enemy' }]),
};

const existingCards = new Set(cardsData.cards.map((c) => c.id));
const addedCards = [];
for (const c of Object.values(SIGNATURES)) {
  if (existingCards.has(c.id)) continue;
  cardsData.cards.push(c);
  existingCards.add(c.id);
  addedCards.push(c.name);
}

// ---------------- 二、新精英 ----------------
/**
 * 每张地图补 2 只。台词按各章的气氛写 ——
 * 精英是「这一章最该记住的那一场」，所以每只都给两句。
 */
const NEW = [
  // 流沙之海（原本只有大钢蛇）
  ['hippowdon', 'desert', [
    '沙丘自己站了起来。原来那不是沙丘。',
    '它张开嘴，风里全是沙在磨牙的声音。',
  ]],
  ['claydol', 'desert', [
    '半埋在沙里的陶偶睁开了身上的红点。',
    '它悬在半空，像是很久以前有人把它留在这里看着什么。',
  ]],
  // 赤岩峡谷
  ['camerupt', 'canyon', [
    '岩壁上的红纹裂开了，里面是亮的。',
    '它每喘一口气，脚边的石头就化一点。',
  ]],
  ['torkoal', 'canyon', [
    '一团白烟沿着谷底滚过来，烟里有壳。',
    '它不动，但它周围的空气在抖。',
  ]],
  // 藤蔓密林
  ['scizor', 'forest', [
    '一片叶子从中间分成两半，切口是直的。',
    '它抬起钳子，钳口上还挂着露水。',
  ]],
  ['scolipede', 'forest', [
    '地面的落叶像被什么东西从下面顶起来。',
    '一节一节地，它从腐叶里把自己拔出来。',
  ]],
  // 潮汐盐海
  ['kingdra', 'tide', [
    '退潮之后，盐壳底下还有一汪水，水里有一个影子在转。',
    '它抬起头，整片盐海的水都跟着晃了一下。',
  ]],
  ['mantine', 'tide', [
    '一只翅膀贴着水面滑过去，没有溅起水花。',
    '它绕回来的时候，你才看清那对翅膀有多宽。',
  ]],
  // 风蚀峭壁
  ['braviary', 'cliff', [
    '风把它托在崖口，它没有扇翅膀。',
    '它低头看你，像是在判断你值不值得下来一趟。',
  ]],
  ['archeops', 'cliff', [
    '岩缝里卡着一副骨架，骨架动了一下。',
    '它飞得歪歪扭扭，但每一下都很快。',
  ]],
  // 夜砂墓原
  ['chandelure', 'night', [
    '远处有一盏灯，你以为那是营地。',
    '走近了才看出，那盏灯在飘，而且它在等你走近。',
  ]],
  ['cofagrigus', 'night', [
    '一具石棺立在沙里，棺盖是开着的。',
    '棺里伸出来的不是手，是别的什么。',
  ]],
];

const existingIds = new Set(enemiesData.enemies.map((e) => e.id));
const addedEnemies = [];
const repaired = [];
for (const [slug, biome, lines] of NEW) {
  const sig = SIGNATURES[slug];
  if (existingIds.has(slug)) {
    // 已经在了：只补「专属招式」这一项（这一批的台词/档位已经定稿，不覆盖）。
    // 需要这一步是因为 tools/assign-enemy-kits.mjs 一度会删掉它不认识的 signature，
    // 已经写进去的内容被清过一次；现在它不删了，这里做个幂等的补写。
    const e = enemiesData.enemies.find((x) => x.id === slug);
    if (sig && !(e.signature ?? []).includes(sig.id)) {
      e.signature = [...(e.signature ?? []), sig.id];
      repaired.push(`${slug} ← ${sig.name}`);
    }
    continue;
  }
  const entry = { id: slug, slug, tier: 'elite', biome, deck: 'kit_normal_hi', lines };
  if (sig) entry.signature = [sig.id];
  enemiesData.enemies.push(entry);
  existingIds.add(slug);
  addedEnemies.push(`${biome}/${slug}${sig ? '（+专属招式 ' + sig.name + '）' : ''}`);
}

const byBiome = {};
for (const e of enemiesData.enemies.filter((x) => x.tier === 'elite')) {
  byBiome[e.biome] = (byBiome[e.biome] ?? 0) + 1;
}
console.log(`新增专属招式 ${addedCards.length} 张：${addedCards.join('、')}`);
console.log(`新增精英 ${addedEnemies.length} 只：`);
for (const a of addedEnemies) console.log('  ' + a);
if (repaired.length) {
  console.log(`补回专属招式 ${repaired.length} 条（之前被 assign-enemy-kits 误删）：`);
  for (const r of repaired) console.log('  ' + r);
}
console.log('每张地图的精英数量：', JSON.stringify(byBiome));

if (WRITE) {
  fs.writeFileSync(cardsFile, JSON.stringify(cardsData, null, 2) + '\n', 'utf8');
  fs.writeFileSync(enemiesFile, JSON.stringify(enemiesData, null, 2) + '\n', 'utf8');
  console.log('\n已写回 content/cards.json 与 content/enemies.json（接着跑 tools/assign-enemy-kits.mjs 分配招式包）');
} else {
  console.log('\n（没有写文件；加 --write 才会写回）');
}
