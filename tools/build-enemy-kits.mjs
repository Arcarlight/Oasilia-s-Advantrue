// Build the per-type enemy move pools (content/enemies.json -> movePools).
//
// 规则（用户要求）：「宝可梦的招式池要符合它的属性，别塞莫名其妙的招式」。
// 所以每个池子 = 该属性的攻击牌 + 两张通用小工具牌，**攻击牌一律本系**：
// 这样任何一只宝可梦拿到自己属性的池子，牌全是同系的，不存在「地面系会扬沙以外的水枪」。
//
// 数值口径必须落在**现有池子的同档中位数**上（余额不能因为这次改动漂移）：
//   低档 8 张（6 攻击 + 2 工具）/ 攻击牌平均费用 ≈1.0
//   高档 11 张（9 攻击 + 2 工具）/ 攻击牌平均费用 ≈1.25
// 攻击牌的威力按「费用-威力曲线」写死在这里（0 费 25~45 / 1 费 95~110 / 2 费 200~240 / 3 费 330~420），
// 和 content/SPEC.md 里给玩家的那套曲线一致。
//
// 缺的同系攻击牌由 tools/tmp-add-cards-2.mjs 补齐（脚本里带了 `missing` 自检）。
//
// Usage:
//   node tools/build-enemy-kits.mjs --check     # 只报告：哪些池子缺牌、数值概况
//   node tools/build-enemy-kits.mjs             # 写入 content/enemies.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

/**
 * 每个属性在 0/1/2/3 费上各有哪些攻击牌（**只写 id，威力在卡表里**）。
 * 前几张是「常用牌」（低档优先取），后面的留给高档。
 */
export const TYPE_MOVES = {
  一般: { 0: ['tackle', 'quick_attack'], 1: ['swift', 'headbutt'], 2: ['slam', 'double_edge', 'body_slam'], 3: ['boomburst', 'giga_impact', 'hyper_beam'] },
  火: { 0: ['ember'], 1: ['flame_charge', 'fire_fang'], 2: ['flamethrower', 'heat_wave'], 3: ['fire_blast', 'overheat', 'inferno_overdrive'] },
  水: { 0: ['aqua_jet'], 1: ['water_shuriken', 'water_pulse'], 2: ['brine', 'aqua_tail'], 3: ['surf', 'hydro_pump', 'whirlpool'] },
  草: { 0: ['branch_poke'], 1: ['absorb', 'razor_leaf'], 2: ['giga_drain', 'seed_bomb', 'bullet_seed'], 3: ['energy_ball', 'leaf_storm', 'solar_beam'] },
  电: { 0: ['thunder_shock'], 1: ['spark', 'thunder_wave', 'charge_beam'], 2: ['volt_tackle', 'discharge'], 3: ['thunder', 'thunderbolt', 'wild_charge'] },
  冰: { 0: ['ice_shard'], 1: ['frost_breath', 'ice_fang'], 2: ['freeze_dry', 'snow_grave', 'triple_axel'], 3: ['blizzard', 'glaciate'] },
  毒: { 0: ['poison_sting'], 1: ['poison_fang', 'venom_dart'], 2: ['venoshock', 'sludge_bomb'], 3: ['gunk_shot', 'toxic_overflow'] },
  地面: { 0: ['sand_attack'], 1: ['earth_power', 'sand_tomb'], 2: ['bulldoze', 'earthquake', 'fissure'], 3: ['precipice_blades'] },
  飞行: { 0: ['peck'], 1: ['air_slash', 'wing_attack'], 2: ['acrobatics', 'aerial_ace'], 3: ['hurricane'] },
  超能: { 0: ['confusion'], 1: ['psybeam', 'extrasensory', 'hypnosis'], 2: ['future_sight', 'psyshock'], 3: ['psychic'] },
  虫: { 0: ['spider_web'], 1: ['bug_buzz', 'fury_cutter', 'twineedle'], 2: ['leech_life', 'pin_missile', 'lunge'], 3: ['megahorn', 'x_scissor'] },
  岩石: { 0: ['rock_throw'], 1: ['accelrock', 'rock_polish'], 2: ['rock_blast', 'rock_slide', 'power_gem'], 3: ['stone_edge', 'head_smash'] },
  幽灵: { 0: ['shadow_sneak'], 1: ['hex', 'curse'], 2: ['night_slash', 'shadow_punch', 'shadow_ball'], 3: ['phantom_force', 'shadow_bone'] },
  龙: { 0: ['dragon_dance'], 1: ['dragon_darts', 'scale_shot'], 2: ['dragon_breath', 'dragon_claw', 'dragon_tail', 'outrage'], 3: ['dragon_rush', 'draco_meteor', 'dragon_ascension'] },
  恶: { 0: ['feint_attack'], 1: ['bite', 'snarl', 'knock_off'], 2: ['crunch', 'dark_pulse', 'foul_play'], 3: ['wicked_blow', 'night_daze'] },
  钢: { 0: ['metal_claw', 'bullet_punch'], 1: ['iron_head', 'flash_cannon'], 2: ['gyro_ball', 'iron_tail', 'sig_meteor_mash'], 3: ['dynamax_cannon', 'doom_desire'] },
  格斗: { 0: ['mach_punch'], 1: ['double_kick', 'rolling_kick'], 2: ['brick_break', 'drain_punch', 'storm_throw', 'cross_chop'], 3: ['focus_punch', 'close_combat', 'superpower'] },
  妖精: { 0: ['fairy_wind'], 1: ['draining_kiss', 'disarming_voice', 'baby_doll_eyes'], 2: ['dazzling_gleam', 'play_rough'], 3: ['moonblast', 'light_of_ruin'] },
};

/**
 * 每个池子取哪几张。低档取「便宜的一张 + 一张常用的 + 两张中费」，高档再加 5 张。
 * 费用分布按**现有池子的同档平均费用**配（低档 ≈1.3 / 高档 ≈1.5），
 * `--check` 会把每个池子的平均费与平均威力打出来对账。
 */
const LOW = { 0: 1, 1: 2, 2: 3, 3: 0 };        // 6 张属性攻击卡
const HIGH_EXTRA = { 0: 0, 1: 1, 2: 0, 3: 2 };  // 高档再加 3 张 → 9 张
/** 通用小工具（不是攻击牌、也不属于任何属性 —— 谁都能用，不会让人觉得「莫名其妙的招式」） */
const UTIL_LOW = ['mob_guard', 'mob_stare'];
const UTIL_HIGH = ['mob_stare', 'protect'];

const poolFor = (type, hi) => {
  const moves = TYPE_MOVES[type];
  if (!moves) throw new Error(`属性 ${type} 没有招式表`);
  const want = { ...LOW };
  if (hi) for (const [ap, n] of Object.entries(HIGH_EXTRA)) want[ap] += n;
  const out = [];
  const missing = [];
  for (const ap of ['0', '1', '2', '3']) {
    const list = moves[ap] ?? [];
    for (let i = 0; i < want[ap]; i++) {
      if (i < list.length) out.push(list[i]);
      else missing.push(`${type} ${ap}费 第 ${i + 1} 张`);
    }
  }
  return { cards: [...out, ...(hi ? UTIL_HIGH : UTIL_LOW)], missing };
};

const TYPE_KITS = Object.keys(TYPE_MOVES);
const kits = {};
const missingAll = [];
for (const type of TYPE_KITS) {
  const low = poolFor(type, false);
  const hi = poolFor(type, true);
  kits[`kit_t_${type}`] = low.cards;
  kits[`kit_t_${type}_hi`] = hi.cards;
  missingAll.push(...low.missing, ...hi.missing);
}

if (CHECK) {
  const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'cards.json'), 'utf8')).cards;
  const byId = new Map(cards.map((c) => [c.id, c]));
  const st = (id) => {
    const c = byId.get(id);
    if (!c) return null;
    const dmg = (c.effects ?? []).filter((e) => e.kind === 'damage').reduce((s, e) => s + (e.power ?? 0) * (e.hits ?? 1), 0);
    return { ap: c.ap, dmg, type: (c.types ?? [])[0] };
  };
  console.log(`属性池 ${TYPE_KITS.length} 种 × 2 = ${TYPE_KITS.length * 2} 个池子`);
  if (missingAll.length) {
    console.log(`⚠ 还缺 ${missingAll.length} 张卡（要在卡表里补）:`);
    for (const m of missingAll) console.log('  - ' + m);
  } else {
    console.log('✓ 卡表里的牌够用，没有缺口');
  }
  console.log('\n池子概览（攻击牌平均费 / 攻击牌平均威力 / 本系占比）:');
  for (const [key, list] of Object.entries(kits)) {
    const rows = list.map(st);
    const unknown = list.filter((id) => !byId.has(id));
    const atk = rows.filter((r) => r && r.dmg > 0);
    const typed = rows.filter((r) => r && r.type && !UTIL_LOW.includes(list[rows.indexOf(r)]));
    const avg = (a) => (a.length ? (a.reduce((s, v) => s + v, 0) / a.length).toFixed(2) : '-');
    const type = key.replace(/^kit_t_/, '').replace(/_hi$/, '');
    const sameType = list.filter((id) => (byId.get(id)?.types ?? [])[0] === type).length;
    console.log(`  ${key.padEnd(20)} n=${String(list.length).padStart(2)} 攻击=${String(atk.length).padStart(2)}` +
      ` 平均费=${avg(atk.map((r) => r.ap))} 平均威力=${avg(atk.map((r) => Math.min(r.dmg, 450)))}` +
      ` 同系=${sameType}/${list.length}` + (unknown.length ? ` ⚠ 缺牌 ${unknown.join(',')}` : ''));
  }
  process.exit(missingAll.length ? 1 : 0);
}

// ---- 写入 ----
const ENEMIES = path.join(ROOT, 'content', 'enemies.json');
const data = JSON.parse(fs.readFileSync(ENEMIES, 'utf8'));
// 旧的 kit_* 池子保留（rewrite-kits 会决定谁还在用），新池子写进去
for (const [key, list] of Object.entries(kits)) data.movePools[key] = list;
data.movePools = Object.fromEntries(Object.entries(data.movePools).sort(([a], [b]) => (a < b ? -1 : 1)));
fs.writeFileSync(ENEMIES, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`写入 ${Object.keys(kits).length} 个属性池（content/enemies.json 共 ${Object.keys(data.movePools).length} 个池子）`);
