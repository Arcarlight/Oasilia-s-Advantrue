// 给「每一类属性的怪」配一套自己的招式，而不是所有敌人都共用 basic/strong/elite/boss 四张表。
//
// 用户需求：「为各类属性的怪添加特别招式，而不是所有敌人都通用一套卡组」。
//
// 做法：
//   · 按物种的**属性**（content/species.json 的 types）分 14 个招式包：
//     地面 / 岩石 / 钢 / 虫 / 草 / 毒 / 水 / 飞行 / 火 / 恶 / 龙 / 幽灵 / 格斗 / 一般
//   · 每个包分两档：`kit_xxx`（杂兵与较强用，**不含永久强化**）与 `kit_xxx_hi`
//     （精英与首领用，多出强化牌、大威力牌与销毁牌）
//   · 首领额外带**专属招式**（enemyOnly 的新卡，写进敌人的 signature 字段，
//     由 game.js 的 buildEnemyDeck 保证一定会进牌组）
//
// 用法: node tools/assign-enemy-kits.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cardsFile = path.join(root, 'content', 'cards.json');
const enemiesFile = path.join(root, 'content', 'enemies.json');
const WRITE = process.argv.includes('--write');

const cardsData = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));
const enemiesData = JSON.parse(fs.readFileSync(enemiesFile, 'utf8'));
const species = JSON.parse(fs.readFileSync(path.join(root, 'content', 'species.json'), 'utf8')).species;

// ---------------- 一、首领专属招式 ----------------
const S = (id, name, rarity, text, effects) => ({
  id, name, ap: rarity.ap, rarity: rarity.rarity, targeting: 'enemy',
  ico: rarity.ico, fx: rarity.fx, text, effects, enemyOnly: true,
});
const SIG = {
  tyranitar: S('sig_sand_fang', '流沙獠牙', { ap: 2, rarity: 'rare', ico: 'ico-stone', fx: 'dirt_1' },
    '造成 {d} 点伤害。本场战斗防御 +5。',
    [{ kind: 'damage', power: 240 }, { kind: 'buff', stat: 'def', amount: 5 }]),
  garchomp: S('sig_dual_chomp', '烈咬突袭', { ap: 2, rarity: 'rare', ico: 'ico-dragon', fx: 'slash_1' },
    '连续 2 次造成 {d} 点伤害，并给对手 1 层出血。',
    [{ kind: 'damage', power: 135, hits: 2 }, { kind: 'status', status: 'bleed', stacks: 1 }]),
  metagross: S('sig_meteor_mash', '彗星拳', { ap: 2, rarity: 'rare', ico: 'ico-meteor', fx: 'spark_05' },
    '造成 {d} 点伤害。本场战斗攻击 +4。',
    [{ kind: 'damage', power: 260 }, { kind: 'buff', stat: 'atk', amount: 4 }]),
  zygarde: S('sig_land_wrath', '大地神力', { ap: 3, rarity: 'epic', ico: 'ico-earthquake', fx: 'earthquake_fx' },
    '造成 {d} 点伤害，并让对手敏捷 -4。',
    [{ kind: 'damage', power: 320 }, { kind: 'buff', stat: 'agi', amount: -4, target: 'enemy' }]),
  sceptile: S('sig_leaf_blade', '叶刃', { ap: 2, rarity: 'rare', ico: 'ico-leaves', fx: 'slash_1' },
    '造成 {d} 点伤害，并给对手 2 层出血。',
    [{ kind: 'damage', power: 250 }, { kind: 'status', status: 'bleed', stacks: 2 }]),
  kyogre: S('sig_origin_pulse', '根源波动', { ap: 2, rarity: 'rare', ico: 'ico-water', fx: 'magic_1' },
    '造成 {d} 点伤害，并给对手 2 层剧毒。',
    [{ kind: 'damage', power: 240 }, { kind: 'status', status: 'toxic', stacks: 2 }]),
  aggron: S('sig_heavy_slam', '重金属坠落', { ap: 3, rarity: 'rare', ico: 'ico-mace', fx: 'dirt_2' },
    '造成 {d} 点伤害，并让对手防御 -30%。',
    [{ kind: 'damage', power: 280 }, { kind: 'buff', stat: 'def', pct: -0.3, target: 'enemy' }]),
  steelix: S('sig_iron_tail_wall', '铁尾壁垒', { ap: 2, rarity: 'uncommon', ico: 'ico-shield_03', fx: 'spark_02' },
    '造成 {d} 点伤害，并获得护盾（随防御成长）。',
    [{ kind: 'damage', power: 210 }, { kind: 'shield', amount: 10, scaleWithDef: true }]),
  gyarados: S('sig_rage_wave', '暴怒巨浪', { ap: 2, rarity: 'uncommon', ico: 'ico-water', fx: 'twirl_1' },
    '造成 {d} 点伤害。本场战斗攻击 +3。',
    [{ kind: 'damage', power: 220 }, { kind: 'buff', stat: 'atk', amount: 3 }]),
};
// fx 名写错了会卡在 check-content，这里做一次兜底映射
const FIX_FX = { earthquake_fx: 'dirt_2' };
for (const s of Object.values(SIG)) if (FIX_FX[s.fx]) s.fx = FIX_FX[s.fx];

// ---------------- 二、按属性分配招式包 ----------------
/** low = 杂兵/较强用的（不含任何「永久强化」牌）；high = 精英/首领用的（low + 强化与大招） */
const KITS = {
  ground: {
    low: ['mob_scratch', 'tackle', 'rock_throw', 'bulldoze', 'sand_tomb', 'rock_slide', 'mob_guard', 'earth_power'],
    high: ['earthquake', 'body_press', 'bulk_up'],
  },
  rock: {
    low: ['mob_scratch', 'tackle', 'rock_throw', 'harden', 'mob_guard', 'rock_blast', 'stone_edge', 'mob_stare'],
    high: ['rock_slide', 'protect', 'iron_defense'],
  },
  steel: {
    // 不能放「子弹拳」：它是 0 费还抽牌，敌人用等于白拿价值（check-content 会拦下来）
    low: ['mob_scratch', 'tackle', 'iron_head', 'harden', 'mob_guard', 'metal_sound', 'headbutt', 'double_kick'],
    high: ['iron_defense', 'protect', 'bulk_up'],
  },
  bug: {
    low: ['mob_scratch', 'tackle', 'twineedle', 'fury_cutter', 'poison_sting', 'bug_buzz', 'u_turn', 'mob_sand'],
    high: ['megahorn', 'bullet_seed', 'swords_dance'],
  },
  grass: {
    low: ['mob_scratch', 'tackle', 'absorb', 'razor_leaf', 'leech_seed', 'spore', 'giga_drain', 'mob_guard'],
    high: ['synthesis', 'leaf_storm', 'quiver_dance'],
  },
  poison: {
    low: ['mob_scratch', 'tackle', 'poison_sting', 'acid_armor', 'venom_drain', 'sludge_bomb', 'toxic', 'mob_sand'],
    // 削弱牌占比有上限（40%），所以高挡只加 2 张纯削弱 + 1 张引爆
    high: ['toxic_spikes', 'plague', 'venom_burst'],
  },
  water: {
    low: ['mob_scratch', 'tackle', 'water_pulse', 'aqua_ring', 'withdraw', 'brine', 'whirlpool', 'mob_guard'],
    high: ['surf', 'moonlight', 'guardian_oath'],
  },
  flying: {
    low: ['mob_scratch', 'tackle', 'nuzzle', 'air_slash', 'acrobatics', 'tailwind', 'storm_throw', 'mob_sand'],
    high: ['feather_dance', 'water_shuriken', 'dragon_ascension'],
  },
  fire: {
    low: ['mob_scratch', 'tackle', 'flame_charge', 'fire_fang', 'heat_wave', 'slash', 'bite', 'mob_sand'],
    high: ['overheat', 'last_stand', 'howl'],
  },
  dark: {
    low: ['mob_scratch', 'tackle', 'bite', 'crunch', 'knock_off', 'night_slash', 'headbutt', 'mob_guard'],
    high: ['scary_face', 'blood_price', 'charm'],
  },
  dragon: {
    low: ['mob_scratch', 'tackle', 'dragon_breath', 'dragon_claw', 'dragon_tail', 'bite', 'mob_guard', 'mob_sand'],
    high: ['dragon_rush', 'draco_meteor', 'dragon_ascension'],
  },
  ghost: {
    low: ['mob_scratch', 'tackle', 'toxic_thread', 'night_slash', 'mob_stare', 'sand_tomb', 'bite', 'mob_sand'],
    high: ['toxic_overflow', 'moonlight', 'venom_burst'],
  },
  fighting: {
    low: ['mob_scratch', 'tackle', 'double_kick', 'rolling_kick', 'headbutt', 'bite', 'mob_guard', 'mob_sand'],
    high: ['superpower', 'bulk_up', 'body_press'],
  },
  normal: {
    low: ['mob_scratch', 'tackle', 'bite', 'mob_sand', 'mob_guard', 'double_kick', 'headbutt', 'mob_stare'],
    high: ['bulk_up', 'last_stand', 'recycle'],
  },
};
/** 宝可梦属性 → 招式包（没列到的属性退回「一般」） */
const TYPE_KIT = {
  地面: 'ground', 岩石: 'rock', 钢: 'steel', 虫: 'bug', 草: 'grass', 毒: 'poison',
  水: 'water', 冰: 'water', 飞行: 'flying', 火: 'fire', 恶: 'dark', 龙: 'dragon',
  幽灵: 'ghost', 超能力: 'ghost', 格斗: 'fighting', 一般: 'normal',
};

// ---------------- 三、写回 ----------------
const existingIds = new Set(cardsData.cards.map((c) => c.id));
const addedSig = [];
for (const [slug, card] of Object.entries(SIG)) {
  if (existingIds.has(card.id)) continue;
  const sp = species[slug];
  card.enemySpecies = slug;
  cardsData.cards.push(card);
  existingIds.add(card.id);
  addedSig.push(`${sp ? sp.name : slug} → ${card.name}`);
}

// 旧的四档池留着（诊断脚本与旧存档引用得到），但敌人不再指向它们。
// 注意顺序：先搬旧的、再写属性包 —— 反过来的话，上一轮已经写进去的 kit_* 会把新内容盖掉。
const pools = {};
for (const [k, v] of Object.entries(enemiesData.movePools)) {
  if (k.startsWith('kit_')) continue;
  pools[k] = v;
}
for (const [name, kit] of Object.entries(KITS)) {
  pools[`kit_${name}`] = kit.low;
  pools[`kit_${name}_hi`] = [...kit.low, ...kit.high];
}
enemiesData.movePools = pools;

const kitOf = (slug) => {
  const types = species[slug]?.types ?? [];
  // 双属性的怪优先用「有特色」的那一半：一般/飞行 → 用飞行包，
  // 否则一堆双属性怪会全挤进「一般」包，看起来又变成所有人共用一套了
  const named = types.map((t) => TYPE_KIT[t]).filter((k) => k && k !== 'normal');
  if (named.length) return named[0];
  for (const t of types) if (TYPE_KIT[t]) return TYPE_KIT[t];
  return 'normal';
};
/** 首领 / 精英 → 专属招式（写在 signature 里，game.js 保证它一定进牌组） */
const SIG_OF = { tyranitar: 'tyranitar', garchomp: 'garchomp', metagross: 'metagross', zygarde: 'zygarde', sceptile: 'sceptile', kyogre: 'kyogre', aggron: 'aggron', steelix: 'steelix', gyarados: 'gyarados' };

const assign = [];
for (const e of enemiesData.enemies) {
  const kit = kitOf(e.slug);
  const hi = e.tier === 'elite' || e.tier === 'boss';
  const before = e.deck;
  e.deck = `kit_${kit}${hi ? '_hi' : ''}`;
  /**
   * 专属招式：**只补自己认识的那几只，别动别人的**。
   *
   * 这里原来写的是 `else delete e.signature` —— 于是本脚本一跑，
   * 任何不在 SIG_OF 里的专属招式都会被删掉（实测：tools/add-elites.mjs 刚给
   * 12 只新精英写的专属招式，被下一次 assign 全清了，只剩 9 条）。
   * 这个脚本管的是「招式包」，signature 归敌人数据自己管，越权删除会让
   * 「先加精英、再重新分配招式包」这种正常顺序悄悄丢内容。
   */
  if (SIG_OF[e.id] && SIG[SIG_OF[e.id]]) e.signature = [SIG[SIG_OF[e.id]].id];
  assign.push(`${e.id.padEnd(18)} ${e.tier.padEnd(7)} ${String(before).padEnd(10)} → ${e.deck}${e.signature ? ' + ' + e.signature.join(',') : ''}`);
}

for (const line of assign) console.log(line);
console.log(`\n新增专属招式 ${addedSig.length} 张：`);
for (const s of addedSig) console.log('  ' + s);
console.log(`招式包 ${Object.keys(KITS).length} 类 × 2 档 = ${Object.keys(KITS).length * 2} 个池`);

if (WRITE) {
  fs.writeFileSync(cardsFile, JSON.stringify(cardsData, null, 2) + '\n', 'utf8');
  fs.writeFileSync(enemiesFile, JSON.stringify(enemiesData, null, 2) + '\n', 'utf8');
  console.log('\n已写回 content/cards.json 与 content/enemies.json');
} else {
  console.log('\n（没有写文件；加 --write 才会写回）');
}
