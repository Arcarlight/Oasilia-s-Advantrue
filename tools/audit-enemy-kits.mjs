// Dump every enemy with its real typing + current kit, so the kit assignment can be
// reviewed as a table instead of by grepping two JSON files.
//
// Usage: node tools/audit-enemy-kits.mjs [--bad] [--type <type>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const enemies = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'enemies.json'), 'utf8'));
const species = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'species.json'), 'utf8')).species;

/** kit key -> the type it is supposed to serve (kept next to the audit so the mapping is auditable) */
export const KIT_TYPE = {
  kit_ground: '地面', kit_rock: '岩石', kit_steel: '钢', kit_bug: '虫', kit_grass: '草',
  kit_poison: '毒', kit_water: '水', kit_flying: '飞行', kit_fire: '火', kit_dark: '恶',
  kit_dragon: '龙', kit_ghost: '幽灵', kit_fighting: '格斗', kit_normal: '一般',
  kit_crystal: '岩石', kit_electric: '电', kit_fungal: '草', kit_ruins: '岩石',
  kit_bleed: '恶', kit_weaken: '毒', kit_debuff: '恶',
};

const onlyBad = process.argv.includes('--bad');
const typeArg = process.argv.includes('--type') ? process.argv[process.argv.indexOf('--type') + 1] : null;

const rows = [];
for (const en of enemies.enemies) {
  const sp = species[en.slug];
  if (!sp) { rows.push({ ...en, types: ['?'], spaced: [] }); continue; }
  const base = (en.deck ?? '').replace(/_hi$/, '');
  const t = KIT_TYPE[base];
  rows.push({
    id: en.id, tier: en.tier, biome: en.biome, deck: en.deck,
    types: sp.types, name: sp.name,
    match: !!t && sp.types.includes(t),
  });
}

const out = rows
  .filter((r) => !typeArg || r.types.includes(typeArg))
  .filter((r) => !onlyBad || !r.match);

console.log(`${out.length} / ${rows.length} enemies` + (typeArg ? ` (type ${typeArg})` : '') + (onlyBad ? ' [off-type only]' : ''));
for (const r of out) {
  console.log(`  ${r.id.padEnd(20)} ${String(r.tier).padEnd(6)} ${String(r.biome).padEnd(8)} ${r.types.join('/').padEnd(10)} ${(r.deck ?? '').padEnd(16)} ${r.match ? '' : '  <-- 不是本系'}`);
}

const byType = new Map();
for (const r of rows) for (const t of r.types) byType.set(t, (byType.get(t) ?? 0) + 1);
console.log('\n出场物种的属性分布（双属性各算一次）:');
for (const [t, n] of [...byType].sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(4)} ${n}`);
