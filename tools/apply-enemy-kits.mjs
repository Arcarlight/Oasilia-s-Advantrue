// Assign every enemy the move kit that matches its real typing.
//
// Why this exists: the kits used to be handed out by hand, and nothing checked that a
// kit had anything to do with the Pokémon holding it — so 怨影娃娃（幽灵）was throwing
// 地面 moves and 冰宝（冰）was throwing 岩石 moves, and nothing in the pipeline noticed
// (there was no way to notice: a card did not know its own type).
//
// Since content/cards.json now carries `types`, the assignment can be mechanical:
//
//   * the type-pure pools are `kit_t_<属性>` (built by tools/build-enemy-kits.mjs)
//   * a species prefers a pool of its own type; when it has two types, the rarer one wins
//     (so Diancie goes 妖精 rather than 岩石, and 天蝎 goes 飞行 rather than 地面)
//   * a tier picks the low pool for mob/normal and the `_hi` pool for elite/boss
//   * SPECIES_OVERRIDE keeps the 准神 / 传说 on their signature pools
//
// Usage:
//   node tools/apply-enemy-kits.mjs            # rewrite content/enemies.json
//   node tools/apply-enemy-kits.mjs --check    # report only, change nothing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIT_TYPE as PLAN_KIT_TYPE, SPECIES_OVERRIDE } from './enemy-kit-plan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENEMIES = path.join(ROOT, 'content', 'enemies.json');
const CHECK = process.argv.includes('--check');

const data = JSON.parse(fs.readFileSync(ENEMIES, 'utf8'));
const species = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'species.json'), 'utf8')).species;
const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'cards.json'), 'utf8')).cards;
const cardType = new Map(cards.map((c) => [c.id, (c.types ?? [])[0] ?? null]));

/** 属性 -> 池子。`kit_t_<属性>` 的名字自带属性；老池子靠 PLAN_KIT_TYPE 的表。 */
const kitsByType = new Map();
const addKit = (type, kit) => {
  if (!type || !data.movePools[kit]) return;
  if (!kitsByType.has(type)) kitsByType.set(type, []);
  if (!kitsByType.get(type).includes(kit)) kitsByType.get(type).push(kit);
};
// 老池子优先放进表里（它们是手挑的，个别招牌怪还在用），属性池排后面
for (const [kit, type] of Object.entries(PLAN_KIT_TYPE)) addKit(type, kit);
for (const kit of Object.keys(data.movePools)) {
  const m = /^kit_t_(.+?)(_hi)?$/.exec(kit);
  if (m) addKit(m[1], kit);
}
/**
 * 低档在前、`_hi` 在后；同档里**属性池优先于老池子** ——
 * 老池子（kit_ghost 之类）是当年手挑的混合池，留它们只是给个别招牌怪兜底，
 * 普通敌人应该走 kit_t_* 那套纯本系池（否则幽灵系又会拿到「流沙地狱」）。
 */
for (const [type, list] of kitsByType) {
  list.sort((a, b) => {
    const hi = Number(a.endsWith('_hi')) - Number(b.endsWith('_hi'));
    if (hi) return hi;
    return Number(b.startsWith('kit_t_')) - Number(a.startsWith('kit_t_'));
  });
}
const poolCount = (t) => (kitsByType.get(t) ?? []).length;
/**
 * 这个属性在敌人名单里有多少只（双属性各算一次）。
 *
 * 挑剔属性时用**出场数量**而不是池子个数：地面系 33 只、飞行系 26 只，
 * 那「地面 + 飞行」的天蝎就该走飞行（地面系本来就不缺代表），
 * 而「幽灵 + 毒」的耿鬼走幽灵（毒系 18 只、幽灵 22 只，两边都不算少，但幽灵更能代表耿鬼）。
 */
const typePopulation = new Map();
for (const en of data.enemies) {
  for (const t of species[en.slug]?.types ?? []) {
    typePopulation.set(t, (typePopulation.get(t) ?? 0) + 1);
  }
}

/** 物种 -> 池子：优先本系；两个属性都能配时，选**出场更少**的那个属性（更招牌） */
function pickKit(sp, tier) {
  const hi = tier === 'elite' || tier === 'boss';
  const cands = (sp.types ?? []).filter((t) => poolCount(t) > 0);
  if (!cands.length) return null;
  cands.sort((a, b) => (typePopulation.get(a) ?? 0) - (typePopulation.get(b) ?? 0));
  for (const type of cands) {
    const kits = kitsByType.get(type);
    const wanted = hi ? kits.filter((k) => k.endsWith('_hi')) : kits.filter((k) => !k.endsWith('_hi'));
    const pick = wanted[0] ?? kits[0];
    if (pick) return pick;
  }
  return null;
}

// ---- 3. 指派 ----
const changes = [];
const unmatched = [];
/** 干跑时也要拿「指派之后」的池子去自检，否则 --check 报的全是旧数据的问题 */
const resolved = new Map();
for (const en of data.enemies) {
  const sp = species[en.slug];
  if (!sp) { unmatched.push(en.id); continue; }
  const want = SPECIES_OVERRIDE[en.id] ?? pickKit(sp, en.tier);
  if (!want) { unmatched.push(`${en.id}(${(sp.types ?? []).join('/')})`); continue; }
  if (!data.movePools[want]) { unmatched.push(`${en.id} -> 池子 ${want} 不存在`); continue; }
  resolved.set(en.id, want);
  if (en.deck !== want) {
    changes.push({ id: en.id, from: en.deck, to: want, types: sp.types.join('/'), tier: en.tier });
    if (!CHECK) en.deck = want;
  }
}

// ---- 4. 自检：每只敌人的池子里至少有一张与它同属性的卡 ----
const noSameType = [];
const offTypeShare = [];
for (const en of data.enemies) {
  const sp = species[en.slug];
  if (!sp) continue;
  const pool = data.movePools[resolved.get(en.id) ?? en.deck] ?? [];
  const same = pool.filter((id) => sp.types.includes(cardType.get(id)));
  if (!same.length) noSameType.push(`${en.id}(${sp.types.join('/')} <- ${resolved.get(en.id) ?? en.deck})`);
  const typed = pool.filter((id) => cardType.get(id));
  if (typed.length) {
    const share = Math.round((same.length / typed.length) * 100);
    if (share < 60) offTypeShare.push(`${en.id} 本系占比 ${share}%（${resolved.get(en.id) ?? en.deck}）`);
  }
}

console.log(`属性池: ${kitsByType.size} 种属性 / ${[...kitsByType.values()].reduce((s, v) => s + v.length, 0)} 个池子`);
console.log(`指派: ${changes.length} 只改动` + (CHECK ? '（--check，未写入）' : ''));
for (const c of changes.slice(0, 200)) console.log(`  ${c.id.padEnd(20)} ${c.types.padEnd(8)} ${c.tier.padEnd(6)} ${String(c.from).padEnd(18)} -> ${c.to}`);
if (changes.length > 200) console.log(`  ...（还有 ${changes.length - 200} 条）`);
console.log(`每只都有本系招式: ${noSameType.length ? '✗ ' + noSameType.length + ' 只没有' : '✓'}`);
for (const x of noSameType.slice(0, 20)) console.log('  ✗ ' + x);
console.log(`本系占比 <60%: ${offTypeShare.length} 只`);
for (const x of offTypeShare.slice(0, 20)) console.log('  ! ' + x);
if (unmatched.length) {
  console.log(`⚠ 没有可用池子: ${unmatched.length} 只`);
  for (const x of unmatched.slice(0, 20)) console.log('  ! ' + x);
}

if (!CHECK) {
  fs.writeFileSync(ENEMIES, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('written: content/enemies.json');
}
